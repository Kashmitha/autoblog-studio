import { BadRequestException, Injectable } from "@nestjs/common";
import { blogger, blogger_v3 } from "googleapis/build/src/apis/blogger";
import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { decrypt, encrypt } from "../domain/security";
import { requireSecret } from "../config";
@Injectable()
export class GoogleService {
  constructor(private readonly db: PrismaService) {}
  oauth() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
      throw new BadRequestException(
        "Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the local .env first.",
      );
    return new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }
  async connect(sessionId: string, analytics = false, searchConsole = false) {
    const client = this.oauth();
    const pkce = await client.generateCodeVerifierAsync();
    const state = randomBytes(32).toString("hex");
    await this.db.oAuthState.create({
      data: {
        id: state,
        sessionId,
        verifier: pkce.codeVerifier,
        expiresAt: new Date(Date.now() + 10 * 60000),
      },
    });
    return {
      url: client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: true,
        state,
        code_challenge: pkce.codeChallenge,
        code_challenge_method: "S256" as never,
        scope: [
          "https://www.googleapis.com/auth/blogger",
          ...(analytics
            ? ["https://www.googleapis.com/auth/analytics.readonly"]
            : []),
          ...(searchConsole
            ? ["https://www.googleapis.com/auth/webmasters.readonly"]
            : []),
        ],
      }),
    };
  }
  async callback(code: string, state: string, sessionId: string) {
    const saved = await this.db.oAuthState.findUnique({ where: { id: state } });
    if (!saved || saved.expiresAt < new Date() || saved.sessionId !== sessionId)
      throw new BadRequestException(
        "OAuth state expired or does not match the signed-in session.",
      );
    await this.db.oAuthState.delete({ where: { id: state } });
    const client = this.oauth();
    const { tokens } = await client.getToken({
      code,
      codeVerifier: saved.verifier,
    });
    const merged = tokens;
    if (!merged.refresh_token)
      throw new BadRequestException(
        "Google did not return a refresh token. Reconnect with consent.",
      );
    const previous = await this.db.integration.findUnique({
      where: { provider: "google" },
    });
    if (previous?.blogId) {
      // An incremental reporting grant must not silently replace the Blogger
      // connection with an unrelated account while retaining its pinned blog.
      client.setCredentials(merged);
      const { data } = await blogger({
        version: "v3",
        auth: client,
      }).blogs.listByUser(
        { userId: "self", role: ["ADMIN"], fetchUserInfo: true },
        { timeout: 20000 },
      );
      const owned =
        data.blogUserInfos?.flatMap(({ blog }) => (blog?.id ? [blog] : [])) ??
        data.items ??
        [];
      if (!owned.some((b) => b.id === previous.blogId))
        throw new BadRequestException(
          "Use the same Google account that owns your connected Blogger blog. Your existing connection has been kept.",
        );
    }
    await this.db.integration.upsert({
      where: { provider: "google" },
      create: {
        provider: "google",
        encryptedTokens: encrypt(
          JSON.stringify(merged),
          requireSecret("TOKEN_ENCRYPTION_KEY"),
        ),
        accountLabel: "Google account",
      },
      update: {
        encryptedTokens: encrypt(
          JSON.stringify(merged),
          requireSecret("TOKEN_ENCRYPTION_KEY"),
        ),
      },
    });
    return { ok: true };
  }
  async client() {
    const integration = await this.db.integration.findUnique({
      where: { provider: "google" },
    });
    if (!integration)
      throw new BadRequestException("Connect your Google account first.");
    const client = this.oauth();
    const tokens = JSON.parse(
      decrypt(
        integration.encryptedTokens,
        requireSecret("TOKEN_ENCRYPTION_KEY"),
      ),
    );
    client.setCredentials(tokens);
    await client.getAccessToken();
    await this.db.integration.updateMany({
      // A refresh started before a new OAuth grant must not overwrite that
      // newer account/permission choice when its network request finishes.
      where: {
        provider: "google",
        encryptedTokens: integration.encryptedTokens,
      },
      data: {
        encryptedTokens: encrypt(
          JSON.stringify({ ...tokens, ...client.credentials }),
          requireSecret("TOKEN_ENCRYPTION_KEY"),
        ),
      },
    });
    return client;
  }
  async reportingPermissions() {
    const integration = await this.db.integration.findUnique({
      where: { provider: "google" },
    });
    if (!integration) return { searchConsole: false, analytics: false };
    try {
      const tokens = JSON.parse(
        decrypt(
          integration.encryptedTokens,
          requireSecret("TOKEN_ENCRYPTION_KEY"),
        ),
      );
      const scopes = new Set(
        typeof tokens.scope === "string" ? tokens.scope.split(/\s+/) : [],
      );
      return {
        searchConsole:
          scopes.has("https://www.googleapis.com/auth/webmasters.readonly") ||
          scopes.has("https://www.googleapis.com/auth/webmasters"),
        analytics:
          scopes.has("https://www.googleapis.com/auth/analytics.readonly") ||
          scopes.has("https://www.googleapis.com/auth/analytics"),
      };
    } catch {
      return { searchConsole: false, analytics: false };
    }
  }
  async blogs() {
    const auth = await this.client();
    const api = blogger({ version: "v3", auth });
    const { data } = await api.blogs.listByUser({
      userId: "self",
      role: ["ADMIN"],
      fetchUserInfo: true,
    });
    // fetchUserInfo changes the response from items[] to blogUserInfos[].blog.
    return (
      data.blogUserInfos?.flatMap(({ blog }) => (blog?.id ? [blog] : [])) ??
      data.items ??
      []
    );
  }
  async select(blogId: string) {
    const blogs = await this.blogs();
    const selected = blogs.find((b) => b.id === blogId);
    if (!selected)
      throw new BadRequestException(
        "Choose a blog owned by the connected account.",
      );
    return this.db.integration
      .update({
        where: { provider: "google" },
        data: {
          blogId,
          blogUrl: selected.url,
          firstLiveTestAuthorizedAt: null,
          liveTestSucceededAt: null,
        },
      })
      .then(() => ({ ok: true }));
  }
  async posts() {
    const i = await this.db.integration.findUnique({
      where: { provider: "google" },
    });
    if (!i?.blogId) throw new BadRequestException("Select a blog first.");
    const api = blogger({ version: "v3", auth: await this.client() });
    const posts: blogger_v3.Schema$Post[] = [];
    let pageToken: string | undefined;
    const seen = new Set<string>();
    for (let page = 0; page < 20; page++) {
      const { data } = await api.posts.list(
        {
          blogId: i.blogId,
          status: ["LIVE", "DRAFT", "SCHEDULED"],
          fetchBodies: false,
          view: "ADMIN",
          maxResults: 50,
          pageToken,
        },
        { timeout: 20000 },
      );
      posts.push(...(data.items || []));
      if (!data.nextPageToken) return posts;
      if (seen.has(data.nextPageToken)) break;
      seen.add(data.nextPageToken);
      pageToken = data.nextPageToken;
    }
    throw new BadRequestException(
      "Could not finish reading Blogger posts. No new post was created; retry the read or link the known post directly.",
    );
  }
  async disconnect() {
    const i = await this.db.integration.findUnique({
      where: { provider: "google" },
    });
    if (i) {
      try {
        const c = this.oauth();
        c.setCredentials(
          JSON.parse(
            decrypt(i.encryptedTokens, requireSecret("TOKEN_ENCRYPTION_KEY")),
          ),
        );
        await c.revokeCredentials();
      } catch {
        /* Local disconnection still removes stored credentials. */
      }
      await this.db.integration.delete({ where: { provider: "google" } });
    }
    await this.db.automationSettings.update({
      where: { id: "owner" },
      data: { paused: true },
    });
    return { ok: true };
  }
}
export interface BloggerAdapter {
  getPost(
    blogId: string,
    postId: string,
  ): Promise<{ id: string; url: string; status: string }>;
  createDraft(
    blogId: string,
    title: string,
    content: string,
    labels: string[],
  ): Promise<string>;
  updateDraft(
    blogId: string,
    id: string,
    title: string,
    content: string,
    labels: string[],
  ): Promise<void>;
  publish(
    blogId: string,
    id: string,
  ): Promise<{ id: string; url: string; status: string }>;
}
export interface RemoteBloggerPost {
  id: string;
  url: string;
  status: string;
  title?: string;
  published?: string | null;
}
@Injectable()
export class LiveBloggerAdapter implements BloggerAdapter {
  constructor(private readonly google: GoogleService) {}
  private async api() {
    return blogger({ version: "v3", auth: await this.google.client() });
  }
  async getPost(blogId: string, postId: string): Promise<RemoteBloggerPost> {
    const p = (
      await (
        await this.api()
      ).posts.get({ blogId, postId, view: "ADMIN" }, { timeout: 20000 })
    ).data;
    return {
      id: p.id!,
      url: p.url || "",
      status: p.status || "",
      title: p.title || "",
      published: p.published || null,
    };
  }
  async createDraft(
    blogId: string,
    title: string,
    content: string,
    labels: string[],
  ) {
    return (
      await (
        await this.api()
      ).posts.insert(
        { blogId, isDraft: true, requestBody: { title, content, labels } },
        { timeout: 20000, retry: false },
      )
    ).data.id!;
  }
  async updateDraft(
    blogId: string,
    postId: string,
    title: string,
    content: string,
    labels: string[],
  ) {
    await (
      await this.api()
    ).posts.update(
      { blogId, postId, requestBody: { title, content, labels } },
      { timeout: 20000 },
    );
  }
  async publish(blogId: string, postId: string): Promise<RemoteBloggerPost> {
    const p = (
      await (
        await this.api()
      ).posts.publish({ blogId, postId }, { timeout: 20000, retry: false })
    ).data;
    return {
      id: p.id!,
      url: p.url || "",
      status: p.status || "LIVE",
      title: p.title || "",
      published: p.published || null,
    };
  }
  async schedulePost(blogId: string, postId: string, publishDate: string) {
    // Never automatically replay a write with an uncertain remote outcome.
    await (
      await this.api()
    ).posts.publish(
      { blogId, postId, publishDate },
      { timeout: 20000, retry: false },
    );
    return this.getPost(blogId, postId);
  }
}
export class MockBloggerAdapter implements BloggerAdapter {
  readonly posts = new Map<
    string,
    { id: string; url: string; status: string }
  >();
  async getPost(_blog: string, id: string) {
    const p = this.posts.get(id);
    if (!p) throw new Error("Mock post not found.");
    return p;
  }
  async createDraft() {
    const id = "mock-" + randomBytes(6).toString("hex");
    this.posts.set(id, { id, url: "", status: "DRAFT" });
    return id;
  }
  async updateDraft() {}
  async publish(_blog: string, id: string) {
    const p = await this.getPost(_blog, id);
    p.status = "LIVE";
    return p;
  }
}
