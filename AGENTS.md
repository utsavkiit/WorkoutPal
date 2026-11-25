# WorkoutPal agent guidance

WorkoutPal is an iPhone-first, offline-first strength logger. Read `README.md` and `docs/DEVELOPMENT_HANDOFF.md` when setup or operational details are needed.

Use [the Kanban board](docs/KANBAN.md) as the single source of truth for priorities, tasks, acceptance criteria, and handoffs. Read it before feature work and follow the user's scope. One agent works at a time: move tasks between lanes and overwrite the short Handoff with current state, decisions, validation, blockers, and the exact next action before stopping.

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

Every feature or behavior change must be verified before it is described as complete or merged. Agents must add or update regression coverage for the changed behavior and record the exact results in `docs/KANBAN.md`.

Required checks for every feature:

1. Run `npm run typecheck`, `npm test`, `npx expo export --platform ios`, and `git diff --check`.
2. Build the self-contained Release simulator app with `npm run e2e:build:ios` and run `npm run e2e:ios`. A targeted Detox run is useful while iterating, but the full suite must pass before merge.
3. Exercise the exact user journey introduced or repaired, including its important failure/recovery path. Add stable accessibility labels or test IDs where needed; do not replace UI assertions with sleeps or disabled synchronization.
4. For physical-device concerns such as offline use, notifications, backgrounding, signing, or standalone launch, build/install the signed Release app on the iPhone and perform the relevant device check. Record any device step that still needs the user; do not claim it passed.
5. For Supabase changes, verify migration parity, RLS/ownership boundaries, rollback-safe database tests, and authenticated sync where applicable. Keep SQLite writes local-first.
6. Review the final diff for unrelated or generated files, preserve user-owned changes, and update the Kanban Handoff with evidence, blockers, and the exact next action.

Do not merge a PR while any required check is failing, skipped, stale, or merely inferred. If a check cannot run, leave the task in Verify/Blocked and state the reason. Merge only after the user asks for a merge or the active task explicitly includes it; before merging, summarize the checks and their results.

Current development uses local Xcode builds on a physical iPhone. Expo Go, EAS, and TestFlight are not required for the development loop.
