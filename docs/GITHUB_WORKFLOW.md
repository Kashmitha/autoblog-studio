# Completed-feature GitHub checkpoints

Push after a complete, tested feature or fix. Keep each checkpoint reviewable instead of pushing every file edit. This repository is public by the owner's choice.

1. Finish the feature, error handling and relevant documentation.
2. Run the checks appropriate to the change. For database changes, back up the local database before migration and verify the installed application.
3. Review the diff and staged file list. Exclude `.env`, tokens, database dumps, uploaded files, downloaded reports, content archives and `.local` evidence. Scan for credentials before pushing.
4. Commit completed code, tests, migrations and documentation with a descriptive message. Push the commit to the intended GitHub branch without force-pushing.
5. Verify the remote commit matches the local commit. Report the commit link, checks performed, any remaining limitations and the exact owner steps to use the feature. GitHub Actions results remain separate from local checks until checked remotely.

GitHub stores application source code, not the running database or runtime secrets. Keep database backups and the private encryption key separately. Pushing code does not deploy the app, resume automation or publish Blogger posts.
