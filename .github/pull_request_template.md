## Feature outcome

Describe the user-visible result and link the Kanban task.

## Verification evidence

- [ ] Work completed in a `codex/*` linked worktree from current `origin/main`
- [ ] Regression coverage includes the success path and important failure/recovery path
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npx expo export --platform ios`
- [ ] `npm run e2e:build:ios`
- [ ] Complete `npm run e2e:ios`
- [ ] `git diff --check`
- [ ] Applicable physical-iPhone checks, or explicitly not applicable
- [ ] Applicable Supabase migration/RLS/authenticated-sync checks, or explicitly not applicable
- [ ] Final diff contains no credentials, generated build output, or unrelated changes
- [ ] Kanban Handoff records exact results and remaining blockers

Do not merge while any applicable item is failing, skipped, stale, inferred, or waiting for user confirmation.
