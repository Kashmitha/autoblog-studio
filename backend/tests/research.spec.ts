import { referenceExcerpt } from "../src/domain/research";
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
