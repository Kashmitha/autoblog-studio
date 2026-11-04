import { BadRequestException, Injectable } from "@nestjs/common";
import { blogger } from "googleapis/build/src/apis/blogger";
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
  async connect(sessionId: string, analytics = false) {
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
        state,
        code_challenge: pkce.codeChallenge,
        code_challenge_method: "S256" as never,
        scope: [
          "https://www.googleapis.com/auth/blogger",
          ...(analytics
            ? [
                "https://www.googleapis.com/auth/webmasters.readonly",
                "https://www.googleapis.com/auth/analytics.readonly",
              ]
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
    await this.db.integration.update({
      where: { provider: "google" },
      data: {
        encryptedTokens: encrypt(
          JSON.stringify({ ...tokens, ...client.credentials }),
          requireSecret("TOKEN_ENCRYPTION_KEY"),
        ),
      },
    });
    return client;
  }
  async blogs() {
    const auth = await this.client();
    const api = blogger({ version: "v3", auth });
    return (
      (
        await api.blogs.listByUser({
          userId: "self",
          role: ["ADMIN"],
          fetchUserInfo: true,
        })
      ).data.items || []
    );
  }
  async select(blogId: string) {
    const blogs = await this.blogs();
    const selected = blogs.find((b) => b.id === blogId);
    if (!selected)
      throw new BadRequestException(
        "Choose a blog owned or authored by the connected account.",
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
    return (
      (
        await blogger({ version: "v3", auth: await this.client() }).posts.list({
          blogId: i.blogId,
          status: ["LIVE", "DRAFT", "SCHEDULED"],
          fetchBodies: false,
          view: "ADMIN",
          maxResults: 50,
        })
      ).data.items || []
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
@Injectable()
export class LiveBloggerAdapter implements BloggerAdapter {
  constructor(private readonly google: GoogleService) {}
  private async api() {
    return blogger({ version: "v3", auth: await this.google.client() });
  }
  async getPost(blogId: string, postId: string) {
    const p = (
      await (
        await this.api()
      ).posts.get({ blogId, postId, view: "ADMIN" }, { timeout: 20000 })
    ).data;
    return { id: p.id!, url: p.url || "", status: p.status || "" };
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
  async publish(blogId: string, postId: string) {
    const p = (
      await (
        await this.api()
      ).posts.publish({ blogId, postId }, { timeout: 20000, retry: false })
    ).data;
    return { id: p.id!, url: p.url || "", status: p.status || "LIVE" };
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
