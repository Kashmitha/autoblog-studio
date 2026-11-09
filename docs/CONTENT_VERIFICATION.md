# Tutorial verification checkpoint

The next tutorial, **How to find which Git commit last changed a line**, is saved in Studio for owner review. The draft is local database content, not a public Blogger post or a source-code fixture. Review it from Articles before approving or choosing a publication time.

## Reproduce the command checks

From the repository root, run:

```powershell
node scripts/verify-git-blame.mjs
```

The script creates a new repository under ignored `.local`, clears inherited Git-specific environment variables and uses a fixture identity. It never cleans, resets or edits the application repository. It retains its fixture and writes private evidence to `.local/git-blame-command-evidence.json`. No provider call or publication occurs.

Seven checks cover a single-line range, inspection of the actual before/after patch, whitespace attribution, uncommitted versus HEAD content, preservation of local file/staging state, rename history and the final branch/tree state. The article's commands were tested using Git 2.55.0.windows.5. Example commit hashes belong to the fixture; readers must use hashes from their own repositories.

Primary references reviewed:

- [Git blame](https://git-scm.com/docs/git-blame): line ranges, revisions, whitespace, rename behavior and surviving-line limitations.
- [Git show](https://git-scm.com/docs/git-show): commit messages and patches.
- [Git log](https://git-scm.com/docs/git-log): single-file history with `--follow`.

The saved draft includes two contextual links to existing tutorials. Code output is sufficient for this topic, so no decorative image was added. Automated quality and responsive preview checks passed; editorial approval remains the owner's next action.
