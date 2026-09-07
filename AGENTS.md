# WorkoutPal engineering context

This repository is the implementation source of truth for WorkoutPal. Read this file and `README.md` before making changes.

## Product intent

WorkoutPal is a personal, iPhone-first strength workout logger inspired by Strong, with a deliberately simpler interface. The primary success criterion is being able to record a set with weight and reps in a few seconds during a workout, including when gym connectivity is poor.

Version-one decisions:

- Expo + React Native + TypeScript, with Expo Router.
- Expo SQLite is the immediate source of truth and Supabase provides authentication and cloud synchronization.
- Email magic-link authentication; the app is also usable in local-only mode before Supabase is configured.
- One active workout at a time.
- Weighted and bodyweight exercises only; cardio/time/distance sets are out of scope.
- Routines store ordered exercises and set counts, not prescribed weights or reps.
- A routine creates an independent workout snapshot when started. Editing the live workout never changes its routine.
- Active workouts may add, remove, replace, or reorder exercises and sets.
- One configurable global rest timer, defaulting to 90 seconds, starts when a set is completed.
- History is read-only in v1 and shows the latest previous values while logging.
- Global lb/kg preference; every historical set retains its original unit.
- No subscriptions, social features, coaching, charts, PR detection, Apple Health, watchOS, or cardio tracking in v1.

## Current implementation

- Four tabs: Workout, Routines, History, and Settings.
- 78 deterministic built-in exercises plus custom exercise creation, search, and muscle filters.
- Routine create/edit/duplicate/archive and exercise ordering/set counts.
- Empty or routine-based workout creation, durable active-session recovery, weight/reps entry, set completion, reordering, finish/discard safeguards, previous values, rest notifications, and haptics.
- Completed workout history and detail views.
- SQLite schema, repository contracts, durable sync outbox, Supabase push/pull merge, magic-link handling, and network/foreground retry.
- Supabase migration, seed catalog, ownership RLS policies, and grants.
- EAS profiles for development, preview, and production.
- Generated placeholder icon using a centered green dumbbell/W mark on charcoal.

Important implementation paths:

- `app/`: Expo Router screens and navigation.
- `src/data/database.ts`: local SQLite schema and operations.
- `src/data/sync.ts`: Supabase outbox upload and remote merge.
- `src/context/AppContext.tsx`: initialization, auth, timer, and sync lifecycle.
- `supabase/migrations/001_workoutpal.sql`: cloud schema and RLS.
- `supabase/seed.sql`: server-side copy of the deterministic exercise catalog.

## Setup and external state

- The app runs in local-only mode without credentials.
- Supabase and Expo accounts have not been connected in this workspace.
- No `.env` is committed. Copy `.env.example` and provide only the Supabase project URL and publishable key.
- Configure `workoutpal://auth/callback` as an allowed Supabase redirect URL.
- Apply both Supabase SQL files before testing sync.
- The provisional bundle ID is `com.utsavmehta.workoutpal` and should be confirmed before App Store registration.
- No TestFlight or App Store build has been submitted.

## Verification completed

The following passed on September 6, 2026:

- `npm run typecheck`
- `npm test` (4 domain tests)
- `npx expo install --check`
- `npx expo export --platform ios`
- Independent execution of the SQLite DDL using the system `sqlite3` binary
- App icon verification: 1024×1024 PNG without alpha

Not yet verified because external accounts/full Xcode were unavailable:

- Supabase migration execution and two-user RLS tests
- Magic-link round trip against a live project
- Physical iPhone airplane-mode, notification, background, and accessibility testing
- EAS preview build and TestFlight submission
- Component and end-to-end UI automation

`npm audit --omit=dev` currently reports 13 moderate transitive advisories in Expo Router/Expo CLI dependencies. Its proposed `--force` fix downgrades or otherwise makes breaking Expo changes; do not apply it blindly. Recheck against the current Expo SDK before changing package versions.

## Working rules

- Preserve local-first behavior: UI writes must never wait for Supabase.
- Use client-generated UUIDs so offline records sync without remapping.
- Keep seeded exercise IDs identical between `src/data/exercises.ts` and `supabase/seed.sql`.
- Keep Supabase service-role credentials out of the application and repository.
- Enable and validate RLS before treating any cloud integration as complete.
- Run type-checking, unit tests, and an iOS export after material changes.
- Prefer large touch targets and minimal prompts in active-workout flows.
