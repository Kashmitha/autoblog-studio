import { blogger } from "googleapis/build/src/apis/blogger";
import {
  GoogleService,
  LiveBloggerAdapter,
} from "../src/infrastructure/blogger.service";
import { encrypt } from "../src/domain/security";
jest.mock("googleapis/build/src/apis/blogger", () => ({ blogger: jest.fn() }));

test("a background credential refresh cannot overwrite a newer OAuth permission grant", async () => {
  const original = process.env.TOKEN_ENCRYPTION_KEY;
  const key = "cd".repeat(32);
  process.env.TOKEN_ENCRYPTION_KEY = key;
  const previous = encrypt(
    JSON.stringify({
      refresh_token: "fixture-old",
      scope: "https://www.googleapis.com/auth/blogger",
    }),
    key,
  );
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const service = new GoogleService({
    integration: {
      findUnique: async () => ({ encryptedTokens: previous }),
      updateMany,
    },
  } as never);
  jest
    .spyOn(service, "oauth")
    .mockReturnValue({
      credentials: { access_token: "fixture-refreshed" },
      setCredentials: jest.fn(),
      getAccessToken: async () => ({ token: "fixture" }),
    } as never);
  try {
    await service.client();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: "google", encryptedTokens: previous },
      }),
    );
  } finally {
    if (original === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = original;
    jest.restoreAllMocks();
  }
});

test("Search Console connection requests read access without adding Analytics permissions", async () => {
  const generateAuthUrl = jest
    .fn()
    .mockReturnValue("https://accounts.google.com/fixture");
  const service = new GoogleService({
    oAuthState: { create: jest.fn() },
  } as never);
  jest.spyOn(service, "oauth").mockReturnValue({
    generateCodeVerifierAsync: async () => ({
      codeVerifier: "fixture",
      codeChallenge: "challenge",
    }),
    generateAuthUrl,
  } as never);
  try {
    await service.connect("fixture-session", false, true);
    expect(generateAuthUrl.mock.calls[0][0]).toMatchObject({
      include_granted_scopes: true,
      scope: [
        "https://www.googleapis.com/auth/blogger",
        "https://www.googleapis.com/auth/webmasters.readonly",
      ],
    });
  } finally {
    jest.restoreAllMocks();
  }
});

test.each([true, false])(
  "reporting reconnection preserves the selected blog only for its owning account (%s)",
  async (owns) => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
    const upsert = jest.fn();
    const service = new GoogleService({
      oAuthState: {
        findUnique: async () => ({
          sessionId: "session",
          verifier: "fixture",
          expiresAt: new Date(Date.now() + 60000),
        }),
        delete: jest.fn(),
      },
      integration: {
        findUnique: async () => ({ blogId: "original-blog" }),
        upsert,
      },
    } as never);
    jest.spyOn(service, "oauth").mockReturnValue({
      getToken: async () => ({
        tokens: {
          refresh_token: "fixture-never-sent",
          scope:
            "https://www.googleapis.com/auth/blogger https://www.googleapis.com/auth/webmasters.readonly",
        },
      }),
      setCredentials: jest.fn(),
    } as never);
    (blogger as jest.Mock).mockReturnValue({
      blogs: {
        listByUser: async () => ({
          data: {
            blogUserInfos: [
              { blog: { id: owns ? "original-blog" : "unrelated-blog" } },
            ],
          },
        }),
      },
    });
    try {
      if (owns) {
        await service.callback("fixture-code", "fixture-state", "session");
        expect(upsert).toHaveBeenCalledTimes(1);
        expect(upsert.mock.calls[0][0].update).not.toHaveProperty("blogId");
        expect(upsert.mock.calls[0][0].update).not.toHaveProperty(
          "liveTestSucceededAt",
        );
      } else {
        await expect(
          service.callback("fixture-code", "fixture-state", "session"),
        ).rejects.toThrow("same Google account");
        expect(upsert).not.toHaveBeenCalled();
      }
    } finally {
      if (original === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
      else process.env.TOKEN_ENCRYPTION_KEY = original;
      jest.restoreAllMocks();
    }
  },
);

test("hands the future date to Blogger without replaying the write, then confirms ADMIN status", async () => {
  const at = "2030-11-06T03:30:00.000Z";
  const publish = jest
    .fn()
    .mockResolvedValue({ data: { id: "future", status: "SCHEDULED" } });
  const get = jest.fn().mockResolvedValue({
    data: {
      id: "future",
      title: "Future post",
      status: "SCHEDULED",
      published: at,
      url: "https://example.com/future",
    },
  });
  (blogger as jest.Mock).mockReturnValue({ posts: { publish, get } });
  const adapter = new LiveBloggerAdapter({
    client: async () => ({}),
  } as unknown as GoogleService);
  expect(await adapter.schedulePost("blog", "future", at)).toMatchObject({
    status: "SCHEDULED",
    published: at,
  });
  expect(publish).toHaveBeenCalledWith(
    { blogId: "blog", postId: "future", publishDate: at },
    { timeout: 20000, retry: false },
  );
  expect(get).toHaveBeenCalledWith(
    { blogId: "blog", postId: "future", view: "ADMIN" },
    { timeout: 20000 },
  );
});

test("reads later Blogger pages so duplicate detection is not limited to the first fifty posts", async () => {
  const list = jest
    .fn()
    .mockResolvedValueOnce({
      data: { items: [{ id: "first" }], nextPageToken: "next" },
    })
    .mockResolvedValueOnce({
      data: {
        items: [
          {
            id: "second",
            title: "Existing scheduled post",
            status: "SCHEDULED",
          },
        ],
      },
    });
  (blogger as jest.Mock).mockReturnValue({ posts: { list } });
  const service = new GoogleService({
    integration: { findUnique: async () => ({ blogId: "blog" }) },
  } as never);
  jest.spyOn(service, "client").mockResolvedValue({} as never);
  expect((await service.posts()).map((p) => p.id)).toEqual(["first", "second"]);
  expect(list.mock.calls[1][0]).toMatchObject({
    pageToken: "next",
    fetchBodies: false,
    view: "ADMIN",
  });
  jest.restoreAllMocks();
});
test("requests admin visibility to reliably distinguish an existing LIVE post from a draft", async () => {
  const get = jest.fn().mockResolvedValue({
    data: { id: "known", url: "https://example.com/known", status: "LIVE" },
  });
  (blogger as jest.Mock).mockReturnValue({ posts: { get } });
  const adapter = new LiveBloggerAdapter({
    client: async () => ({}),
  } as unknown as GoogleService);
  expect((await adapter.getPost("blog", "known")).status).toBe("LIVE");
  expect(get).toHaveBeenCalledWith(
    { blogId: "blog", postId: "known", view: "ADMIN" },
    { timeout: 20000 },
  );
});

describe("owned blog discovery", () => {
  afterEach(() => jest.restoreAllMocks());
  async function discover(data: object) {
    const listByUser = jest.fn().mockResolvedValue({ data });
    (blogger as jest.Mock).mockReturnValue({ blogs: { listByUser } });
    const service = new GoogleService({} as never);
    jest.spyOn(service, "client").mockResolvedValue({} as never);
    return { blogs: await service.blogs(), listByUser };
  }
  test("unwraps blogs returned with per-user information instead of treating the account as empty", async () => {
    const blog = {
      id: "fixture-blog",
      name: "Fixture owned blog",
      url: "https://fixture.example/",
    };
    const { blogs, listByUser } = await discover({
      kind: "blogger#blogList",
      blogUserInfos: [
        {
          kind: "blogger#blogUserInfo",
          blog,
          blog_user_info: { role: "ADMIN" },
        },
      ],
    });
    expect(blogs).toEqual([blog]);
    expect(listByUser).toHaveBeenCalledWith({
      userId: "self",
      role: ["ADMIN"],
      fetchUserInfo: true,
    });
  });
  test("retains support for ordinary blog-list responses", async () => {
    const blog = { id: "fixture-blog", name: "Fixture owned blog" };
    expect((await discover({ items: [blog] })).blogs).toEqual([blog]);
  });
  test("returns a genuine empty list when no blogs are available", async () => {
    expect((await discover({ kind: "blogger#blogList" })).blogs).toEqual([]);
    expect((await discover({ blogUserInfos: [] })).blogs).toEqual([]);
  });
  test("ignores incomplete per-user entries without a selectable blog", async () => {
    expect(
      (
        await discover({
          blogUserInfos: [{}, { blog: { name: "Missing ID" } }],
        })
      ).blogs,
    ).toEqual([]);
  });
});
