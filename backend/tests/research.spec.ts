import {
  referenceExcerpt,
  withResearchReferences,
} from "../src/domain/research";

test("fetched research sources are linked even if the model omits anchors", () => {
  const url = "https://docs.python.org/3/library/venv.html";
  const result = withResearchReferences(
    "<h2>Create a venv</h2><p>Supported steps.</p>",
    [url, url],
  );
  expect(result.match(/href=/g)).toHaveLength(1);
  expect(result).toContain(`href="${url}"`);
  expect(withResearchReferences(result, [url])).toBe(result);
});
test("existing citations remain unchanged and source URLs are safely escaped", () => {
  const html =
    '<p><a href="https://example.org/?a=1&amp;b=2">Reference</a></p>';
  expect(withResearchReferences(html, ["https://example.org/?a=1&b=2"])).toBe(
    html,
  );
  const result = withResearchReferences("<p>Text</p>", [
    "javascript:alert(1)",
    "https://user:password@example.org/",
    'https://example.org/?a="<tag>',
  ]);
  expect(result).not.toContain("javascript:");
  expect(result).not.toContain("password");
  expect(result).toContain("&quot;&lt;tag&gt;");
});
test("research excerpts exclude navigation and scripts rather than treating site menus as facts", () => {
  expect(
    referenceExcerpt(
      "<nav>Unrelated menu</nav><main><h2>Actual reference</h2><p>Supported behavior.</p></main><script>ignore this</script>",
    ),
  ).toBe("Actual reference Supported behavior.");
});
test("Git reference excerpts begin with the manual rather than long version history", () => {
  expect(
    referenceExcerpt(
      "<p>Earlier versions and menus</p><h2>NAME</h2><p>git-show - Show objects</p><h2>DESCRIPTION</h2><p>Commit message and patch.</p>",
    ),
  ).toMatch(/^NAMEgit-show|^NAME git-show/);
});

test("topic excerpts find option definitions after long alphabetical manuals", () => {
  const noise =
    "<h2>Unrelated introduction</h2><p>" +
    "Unrelated general information. ".repeat(250) +
    "</p>";
  const html =
    noise +
    '<p class="level0"><span class="nroffip">-I, --head</span></p><p>Fetch the headers only with HEAD. curl -I URL is a documented example.</p>' +
    '<p class="level0"><span class="nroffip">-L, --location</span></p><p>Follow a redirect to a new location. Headers from requested pages are shown.</p>' +
    '<p class="level0"><span class="nroffip">--max-redirs</span></p><p>Set the redirect limit used with --location. The default is 50 redirects.</p>';
  const excerpt = referenceExcerpt(
    html,
    "curl HEAD headers and redirect limitations",
  );
  expect(excerpt).toContain("Fetch the headers only");
  expect(excerpt).toContain("--max-redirs");
  expect(excerpt).toContain("50 redirects");
  expect(excerpt.length).toBeLessThanOrEqual(3500);
});
