import { blogger } from "googleapis/build/src/apis/blogger";
import {
  GoogleService,
  LiveBloggerAdapter,
} from "../src/infrastructure/blogger.service";
jest.mock("googleapis/build/src/apis/blogger", () => ({ blogger: jest.fn() }));
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
