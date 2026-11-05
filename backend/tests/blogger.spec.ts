import { blogger } from "googleapis/build/src/apis/blogger";
import {
  GoogleService,
  LiveBloggerAdapter,
} from "../src/infrastructure/blogger.service";
jest.mock("googleapis/build/src/apis/blogger", () => ({ blogger: jest.fn() }));

test("hands the future date to Blogger without replaying the write, then confirms ADMIN status", async () => {
  const at = "2030-11-06T03:30:00.000Z";
  const publish = jest
    .fn()
    .mockResolvedValue({ data: { id: "future", status: "SCHEDULED" } });
  const get = jest
    .fn()
    .mockResolvedValue({
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
