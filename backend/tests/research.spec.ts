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
