import {
  linkKey,
  linkedUrls,
  suggestInternalLinks,
  LinkArticle,
} from "../src/domain/internal-links";
const blog = "https://fixture.blogspot.com/";
const source: LinkArticle = {
  id: "source",
  title: "How to unstage Git changes",
  intent: "Preserve staged work",
  niche: "Git",
  labels: ["Git"],
  html: "",
  publishedUrl: null,
};
const post = (id: string, patch: Partial<LinkArticle> = {}): LinkArticle => ({
  ...source,
  id,
  title: "Compare Git branches",
  intent: "",
  publishedUrl: blog + id,
  ...patch,
});
test("canonical link keys stay on the selected HTTPS blog and normalize only mobile flags and fragments", () => {
  expect(linkKey("/post?m=1#part", blog)).toBe(blog + "post");
  for (const url of [
    "http://fixture.blogspot.com/post",
    "https://evil.test/post",
    "https://u:p@fixture.blogspot.com/post",
    "javascript:alert(1)",
  ])
    expect(linkKey(url, blog)).toBeNull();
  expect(linkKey("/post?tracking=1", blog)).toBe(blog + "post?tracking=1");
});
test("only real anchors count, including relative URLs, entities and mobile variants", () => {
  const links = linkedUrls(
    '<script>const fake=\'<a href="/fake">fake</a>\'</script><!-- <a href="/comment"> --><template><a href="/template">x</a></template><a href="/post?m=1#part">x</a><a href="/a?x=1&amp;y=2">y</a>',
    blog,
  );
  expect([...links]).toEqual([blog + "post", blog + "a?x=1&y=2"]);
});
test("suggestions exclude self, existing links, duplicate URLs and other blogs without requiring indexing", () => {
  const results = suggestInternalLinks(
    { ...source, html: '<a href="/existing?m=1#part">read</a>' },
    [
      post("source"),
      post("existing"),
      post("one"),
      post("two", { publishedUrl: blog + "one?m=1" }),
      post("external", { publishedUrl: "https://evil.test/post" }),
    ],
    blog,
  );
  expect(results.map((s) => s.id)).toEqual(["one"]);
  expect(results[0].sharedTerms).toContain("git");
});
test("shared niche alone does not manufacture relevance; stronger matches rank first and results are bounded", () => {
  expect(
    suggestInternalLinks(
      source,
      [
        post("x", {
          title: "Bake sourdough bread",
          intent: "Bake",
          labels: [],
        }),
      ],
      blog,
    ),
  ).toEqual([]);
  const results = suggestInternalLinks(
    source,
    [
      post("a"),
      post("b", { title: "Git staged work", intent: "Preserve staged work" }),
      ...Array.from({ length: 8 }, (_, i) => post("rest" + i)),
    ],
    blog,
  );
  expect(results[0].id).toBe("b");
  expect(results).toHaveLength(5);
});
