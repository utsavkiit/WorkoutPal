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

Current development uses local Xcode builds on a physical iPhone. Expo Go, EAS, and TestFlight are not required for the development loop.
