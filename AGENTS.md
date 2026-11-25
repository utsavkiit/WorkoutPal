# WorkoutPal agent guidance

WorkoutPal is an iPhone-first, offline-first strength logger. Read `README.md` and `docs/DEVELOPMENT_HANDOFF.md` when setup or operational details are needed.

Use [the Kanban board](docs/KANBAN.md) as the single source of truth for priorities, tasks, acceptance criteria, and handoffs. Read it before feature work and follow the user's scope. One agent works at a time: move tasks between lanes and overwrite the short Handoff with current state, decisions, validation, blockers, and the exact next action before stopping.

## End-to-end feature delivery

Every user request to add or change a feature carries standing authorization to complete the repository delivery lifecycle without asking separately for each step: create an isolated worktree and branch, implement the change and regression coverage, validate it, commit, push, open a pull request, enable auto-merge, wait for required checks, merge only when green, and clean up the merged worktree. If a required check needs user action or cannot run, stop before merge and leave the PR open with the blocker recorded.

Before editing feature files:

1. Fetch `origin` and create a linked worktree from the latest `origin/main` on a `codex/<short-feature-name>` branch. Never develop a feature in the primary checkout or directly on `main`.
2. Run `npm run verify:worktree` inside that worktree. If it fails, move the work to a proper linked worktree before continuing.
3. Move the task to In progress in `docs/KANBAN.md` and keep all changes for that feature in the same worktree/branch.

## Architecture

- Expo SDK 54, React Native, TypeScript, Expo Router, and a committed native iOS project.
- SQLite is the immediate source of truth; Supabase Auth/Postgres sync through a durable outbox.
- Key paths: `app/` for screens, `src/data/database.ts` for SQLite, `src/data/sync.ts` for Supabase, and `src/context/AppContext.tsx` for lifecycle state.
- Supabase schema, RLS, seed data, and tests live under `supabase/`.

## Rules

- Preserve local-first behavior: UI writes must never wait for Supabase.
- Use client-generated UUIDs and keep seeded exercise IDs identical locally and remotely.
- Keep service-role keys, `.env`, Apple credentials, Pods, and build output out of Git.
- Keep RLS enabled and validate ownership boundaries for cloud changes.
- Serialize SQLite initialization and synchronization; never allow overlapping transactions.
- Prefer large touch targets and minimal prompts during active workouts.
- Open `ios/WorkoutPal.xcworkspace`; use `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` for CocoaPods and Xcode commands.
- Run `npm run typecheck`, `npm test`, and an iOS export after material changes.

## Feature delivery and merge gate

Every feature or behavior change must be verified before it is described as complete or merged. Add or update regression coverage for the changed behavior and record exact evidence in `docs/KANBAN.md`.

Required local checks for every feature:

1. Run `npm run typecheck`, `npm test`, `npx expo export --platform ios`, and `git diff --check`.
2. Build the self-contained Release simulator app with `npm run e2e:build:ios` and run the complete `npm run e2e:ios` suite. Targeted Detox tests are only for iteration.
3. Exercise the exact success journey introduced or repaired and its important failure/recovery path. Add stable accessibility labels or test IDs; do not replace assertions with sleeps or disabled synchronization.
4. For physical-device behavior—offline use, notifications, backgrounding, signing, standalone launch, or accessibility—install the signed Release app on the iPhone and perform the applicable checks.
5. For Supabase changes, verify migration parity, RLS and ownership boundaries, rollback-safe database tests, and authenticated sync as applicable. Preserve local-first writes.
6. Review the final diff for unrelated or generated files and credentials, then update the Kanban Handoff with results, blockers, and the exact next action.

Required delivery sequence after local checks pass:

1. Commit all intended feature files and push the `codex/*` branch.
2. Open a PR to `main`, include the validation evidence, and enable auto-merge with squash. A feature request is standing authorization for these delivery actions; do not wait for another “commit,” “push,” “open PR,” or “merge” prompt.
3. Wait for the repository's required `Quality` and `iOS UI` checks. Do not merge around branch protection, use an admin bypass, weaken a check, or claim that queued checks passed.
4. Merge only after every required local, CI, device, and Supabase check applicable to the feature is green. If anything is failing, skipped, stale, or needs user confirmation, keep the PR open and the Kanban task in Verify/Blocked.
5. After merge, confirm `main` contains the merge, then remove the clean feature worktree and delete the merged branch. Never delete a worktree with uncommitted changes.

GitHub Actions and `main` branch protection are the machine-enforced merge gate. Repository instructions define the additional local/device checks that hosted CI cannot perform.

Current development uses local Xcode builds on a physical iPhone. Expo Go, EAS, and TestFlight are not required for the development loop.
