import { blogger } from "googleapis/build/src/apis/blogger";
import {
  GoogleService,
  LiveBloggerAdapter,
} from "../src/infrastructure/blogger.service";
jest.mock("googleapis/build/src/apis/blogger", () => ({ blogger: jest.fn() }));
test("requests admin visibility to reliably distinguish an existing LIVE post from a draft", async () => {
  const get = jest
    .fn()
    .mockResolvedValue({
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
