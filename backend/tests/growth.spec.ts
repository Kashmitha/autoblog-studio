import { promotionPack, searchOpportunities } from "../src/domain/growth";
const blog = "https://fixture.blogspot.com/";
const article = {
  id: "abc123",
  title: "Docker volumes explained",
  excerpt: "Keep files when replacing a container.",
  html: "<p>Body</p>",
  publishedUrl: blog + "post.html?m=1&utm_source=old#section",
};
test("promotion links keep their article destination and stable campaign, and replace existing tracking", () => {
  const p = promotionPack(article, blog);
  expect(p.channels).toHaveLength(3);
  for (const c of p.channels) {
    const u = new URL(c.url);
    expect(u.origin).toBe(new URL(blog).origin);
    expect(u.pathname).toBe("/post.html");
    expect(u.searchParams.getAll("utm_source")).toEqual([c.source]);
    expect(u.searchParams.get("utm_campaign")).toBe("article-abc123");
    expect(u.searchParams.has("m")).toBe(false);
    expect(u.hash).toBe("");
    expect(c.text).toContain(article.excerpt);
  }
  expect(p.channels[1].text).toContain("from my blog");
  expect(() =>
    promotionPack(
      { ...article, publishedUrl: "https://elsewhere.example/post" },
      blog,
    ),
  ).toThrow();
});
test("promotion summaries remove markup and cannot invent experience", () => {
  const p = promotionPack(
    {
      ...article,
      excerpt: "",
      html: "<p>First point.</p><script>alert('x')</script><p>Next point.</p>",
    },
    blog,
  );
  expect(p.summary).toBe("First point. Next point.");
  expect(p.channels[0].text).not.toContain("alert");
  expect(p.channels[0].text).not.toContain("I tested");
});
test("query opportunities use valid same-blog data, retain real zero clicks and rank by impressions", () => {
  const rows = searchOpportunities(
    [
      {
        keys: ["docker volumes", blog + "post.html"],
        clicks: 0,
        impressions: 90,
        ctr: 0,
        position: 12,
      },
      {
        keys: ["escape", "https://other.example/post"],
        clicks: 1,
        impressions: 999,
        ctr: 0.01,
        position: 1,
      },
      {
        keys: ["bad", blog + "post.html"],
        clicks: 3,
        impressions: 2,
        ctr: 2,
        position: 1,
      },
      {
        keys: ["docker storage", blog + "post.html"],
        clicks: 3,
        impressions: 20,
        ctr: 0.15,
        position: 4,
      },
    ],
    blog,
  );
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    query: "docker volumes",
    clicks: 0,
    impressions: 90,
  });
  expect(rows[0].action).toContain("title and opening");
  expect(searchOpportunities([], blog)).toEqual([]);
});
