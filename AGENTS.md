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
- Supabase project `aafxbjevyxrpgyxikxrg` is linked. The ignored `.env` contains its URL and publishable client key.
- No `.env` is committed. Copy `.env.example` and provide only the Supabase project URL and publishable key.
- `workoutpal://auth/callback` is configured as an allowed Supabase redirect URL.
- The migration and seed have been applied to the linked project.
- Bundle ID: `com.utsavmehta.workoutpal`. Apple team: `N6Y7G2993R`.
- The app uses Expo SDK 54, React Native 0.81.5, and a locally generated iOS project because Xcode 16.4 cannot build the former SDK 57/Swift 6.2 dependency set.
- Local development uses an Xcode-signed development build on a physical iPhone. Expo Go and EAS are not required for this workflow.
- Open `ios/WorkoutPal.xcworkspace`, never the `.xcodeproj`, when working in Xcode.
- CocoaPods and Xcode commands must run with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`. The Podfile also pins these values for pod targets to avoid a macOS `C.UTF-8` Perl locale crash.
- The Supabase CLI is available through `npx supabase`; its login is machine-local and is not committed. Use `npx supabase login --agent no` in Codex terminals when interactive login is needed.
- No TestFlight or App Store build has been submitted.

## Verification completed

The following passed on September 10, 2026:

- `npm run typecheck`
- `npm test` (4 domain tests)
- `npx expo export --platform ios`
- Signed Xcode Debug build, installation, and launch on an iPhone 14 running iOS 18.7.8
- Metro development-client bundle over the local Wi-Fi network
- Email magic-link authentication and restored native session
- Authenticated Supabase push and pull with RLS enabled
- Transaction-only two-user Supabase RLS checks and a clean security advisor result

Not yet verified:

- Physical iPhone airplane-mode, notification, extended background, and accessibility testing
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
- Never commit `.env`, Supabase access tokens, database passwords, Apple certificates, provisioning profiles, Pods, DerivedData, or `.xcode.env.local`.
- Read `docs/DEVELOPMENT_HANDOFF.md` for exact local build, install, Metro, and Supabase commands before changing native dependencies.
