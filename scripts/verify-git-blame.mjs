// Verify tutorial examples only inside a newly created, ignored fixture repository.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

await mkdir(".local", { recursive: true });
const fixture = await mkdtemp(resolve(".local/git-blame-"));
const env = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  ),
  GIT_AUTHOR_NAME: "Tutorial Author",
  GIT_AUTHOR_EMAIL: "tutorial@example.invalid",
  GIT_COMMITTER_NAME: "Tutorial Author",
  GIT_COMMITTER_EMAIL: "tutorial@example.invalid",
  GIT_AUTHOR_DATE: "2026-11-09T08:00:00Z",
  GIT_COMMITTER_DATE: "2026-11-09T08:00:00Z",
};
const git = (...args) =>
  execFileSync(
    "git",
    [
      "-c",
      "core.autocrlf=false",
      "-c",
      "commit.gpgsign=false",
      "-c",
      `core.hooksPath=${resolve(fixture, "unused-hooks")}`,
      "--no-pager",
      ...args,
    ],
    { cwd: fixture, env, encoding: "utf8" },
  );
git("init", "-b", "main");
assert.equal(resolve(git("rev-parse", "--show-toplevel").trim()), fixture);
const file = resolve(fixture, "app config.txt");
await writeFile(file, "mode=development\nretries=2\nlogging=enabled\n");
git("add", "--", "app config.txt");
git("commit", "-m", "Add example configuration");
const initial = git("rev-parse", "HEAD").trim();
await writeFile(file, "mode=development\nretries=5\nlogging=enabled\n");
git("add", "--", "app config.txt");
git("commit", "-m", "Increase retry limit");
const changed = git("rev-parse", "HEAD").trim();
const checks = [];
const check = (name, action) => {
  action();
  checks.push(name);
};
const range = git("blame", "--date=short", "-L", "2,2", "--", "app config.txt");
check("a single-line range identifies the content-changing commit", () => {
  assert(range.startsWith(changed.slice(0, 8)));
  assert(range.includes("retries=5"));
  assert.equal(range.trim().split("\n").length, 1);
});
const patch = git("show", changed, "--", "app config.txt");
check("the attributed commit patch shows the actual old and new value", () => {
  assert(patch.includes("-retries=2"));
  assert(patch.includes("+retries=5"));
});
await writeFile(file, "mode=development\nretries = 5\nlogging=enabled\n");
git("add", "--", "app config.txt");
git("commit", "-m", "Space configuration assignments");
const whitespace = git("rev-parse", "HEAD").trim();
const ordinary = git("blame", "-L", "2,2", "--", "app config.txt");
const ignored = git("blame", "-w", "-L", "2,2", "--", "app config.txt");
check(
  "ordinary blame shows whitespace edits while -w reaches the value change",
  () => {
    assert(ordinary.startsWith(whitespace.slice(0, 8)));
    assert(ignored.startsWith(changed.slice(0, 8)));
  },
);
await writeFile(file, "mode=development\nretries = 9\nlogging=enabled\n");
const dirtyBefore = await readFile(file, "utf8");
const dirtyStatus = git("status", "--porcelain");
const dirty = git("blame", "-L", "2,2", "--", "app config.txt");
const committed = git("blame", "HEAD", "-L", "2,2", "--", "app config.txt");
check(
  "working-copy changes are uncommitted while HEAD inspects the saved revision",
  () => {
    assert(dirty.startsWith("00000000"));
    assert(dirty.includes("Not Committed Yet"));
    assert(dirty.includes("retries = 9"));
    assert(committed.startsWith(whitespace.slice(0, 8)));
    assert(committed.includes("retries = 5"));
  },
);
check("inspection commands preserve dirty file bytes and staging state", () => {
  assert.equal(git("status", "--porcelain"), dirtyStatus);
});
assert.equal(await readFile(file, "utf8"), dirtyBefore);
// Restore this fixture by writing its known bytes, without checkout/reset/clean.
await writeFile(file, "mode=development\nretries = 5\nlogging=enabled\n");
git("mv", "--", "app config.txt", "renamed config.txt");
git("commit", "-m", "Rename example configuration");
const renamed = git("blame", "-w", "-L", "2,2", "--", "renamed config.txt");
const history = git("log", "--oneline", "--follow", "--", "renamed config.txt");
check(
  "quoted renamed paths retain line attribution and single-file history",
  () => {
    assert(renamed.startsWith(changed.slice(0, 8)));
    assert(history.includes("Increase retry limit"));
    assert(history.includes(initial.slice(0, 7)));
  },
);
check(
  "all inspections leave the fixture branch and committed tree intact",
  () => {
    assert.equal(git("branch", "--show-current").trim(), "main");
    assert.equal(git("status", "--porcelain").trim(), "");
  },
);
const result = {
  gitVersion: git("--version").trim(),
  checks,
  outputs: {
    range,
    patch,
    ordinary,
    ignored,
    dirty,
    committed,
    renamed,
    history,
  },
  commits: { initial, changed, whitespace },
};
await writeFile(
  ".local/git-blame-command-evidence.json",
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    gitVersion: result.gitVersion,
    checks,
    evidence: ".local/git-blame-command-evidence.json",
  }),
);
