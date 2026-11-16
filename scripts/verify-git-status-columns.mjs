import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const taskRoot = resolve(".local/git-status-verification");
await mkdir(taskRoot, { recursive: true });
const cwd = await mkdtemp(join(taskRoot, "run-"));
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
);
const git = (...args) =>
  execFileSync(
    "git",
    [
      "-c",
      "core.autocrlf=false",
      "-c",
      "commit.gpgsign=false",
      "-c",
      `core.hooksPath=${join(cwd, ".git", "hooks")}`,
      ...args,
    ],
    { cwd, env, encoding: "utf8", windowsHide: true },
  ).trimEnd();
const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}
git("init", "--template=", "-q");
git("config", "user.name", "Verification fixture");
git("config", "user.email", "fixture@example.invalid");
await writeFile(join(cwd, "notes.txt"), "title=old\nbody=old\n");
git("add", "--", "notes.txt");
git("commit", "-qm", "Initial fixture");
await writeFile(join(cwd, "notes.txt"), "title=new\nbody=old\n");
git("add", "--", "notes.txt");
await writeFile(join(cwd, "notes.txt"), "title=new\nbody=new\n");
const before = await readFile(join(cwd, "notes.txt"));
check("Tracked path appears as MM", () =>
  assert.equal(git("status", "--short"), "MM notes.txt"),
);
const staged = git("diff", "--cached", "--", "notes.txt"),
  unstaged = git("diff", "--", "notes.txt"),
  combined = git("diff", "HEAD", "--", "notes.txt");
check("Cached diff contains only first staged edit", () => {
  assert(staged.includes("+title=new"));
  assert(!staged.includes("+body=new"));
});
check("Working diff contains only later edit", () => {
  assert(unstaged.includes("+body=new"));
  assert(!unstaged.includes("+title=new"));
});
check("HEAD comparison includes both edits", () => {
  assert(combined.includes("+title=new"));
  assert(combined.includes("+body=new"));
});
check("Index contains the staged snapshot", () =>
  assert.equal(git("show", ":notes.txt"), "title=new\nbody=old"),
);
check("Read-only inspection preserves file bytes", () =>
  assert.deepEqual(
    execFileSync("git", ["hash-object", "--", "notes.txt"], { cwd, env }),
    execFileSync("git", ["hash-object", "--stdin"], {
      cwd,
      env,
      input: before,
    }),
  ),
);
git("restore", "--staged", "--", "notes.txt");
check("Unstage produces a working-tree-only modification", () =>
  assert.equal(git("status", "--short"), " M notes.txt"),
);
check("Unstage empties the cached diff", () =>
  assert.equal(git("diff", "--cached", "--", "notes.txt"), ""),
);
check("Unstage retains both edits", () =>
  assert(git("diff", "--", "notes.txt").includes("+body=new")),
);
assert.deepEqual(await readFile(join(cwd, "notes.txt")), before);
checks.push("Unstage preserves exact file bytes");
git("add", "--", "notes.txt");
check("Restaging produces index-only modification", () =>
  assert.equal(git("status", "--short"), "M  notes.txt"),
);
check("Restaging leaves working diff empty", () =>
  assert.equal(git("diff", "--", "notes.txt"), ""),
);
await writeFile(join(cwd, "new note.txt"), "first draft\n");
git("add", "--", "new note.txt");
await writeFile(join(cwd, "new note.txt"), "second draft\n");
check("New staged path with later changes appears as AM", () =>
  assert(git("status", "--short").includes('AM "new note.txt"')),
);
git("restore", "--staged", "--", "new note.txt");
check("Unstaging a new path makes it untracked", () =>
  assert(git("status", "--short").includes('?? "new note.txt"')),
);
assert.equal(
  await readFile(join(cwd, "new note.txt"), "utf8"),
  "second draft\n",
);
checks.push("New-file unstage preserves current contents");
const result = {
  gitVersion: git("--version"),
  checksPassed: checks.length,
  checks,
  isolatedRepository: cwd,
  mainRepositoryUntouched: true,
};
await writeFile(
  ".local/git-status-command-verification.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
