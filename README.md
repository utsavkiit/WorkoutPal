# WorkoutPal

WorkoutPal is an offline-first iPhone workout logger built with Expo, React Native, TypeScript, SQLite, and Supabase. You can create routines, add custom exercises, log weight and reps, run a rest timer, and review workout history even without a network connection.

## Run locally

Requirements: Node.js 22.13 or newer, Xcode 16.4, CocoaPods, and an iPhone with Developer Mode enabled. This repository uses an Expo development build; Expo Go is not required.

```bash
npm install
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --project-directory=ios
npx expo start --dev-client --lan
```

Build and install from `ios/WorkoutPal.xcworkspace`, or run the documented `xcodebuild` commands in [`docs/DEVELOPMENT_HANDOFF.md`](docs/DEVELOPMENT_HANDOFF.md). Keep Metro running while testing JavaScript and TypeScript changes on the phone.

The app works immediately in local-only mode. Copy `.env.example` to `.env` to enable authentication and synchronization:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never put a Supabase service-role key in the app.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_workoutpal.sql` in the SQL editor.
3. Run `supabase/seed.sql` to install the matching exercise catalog.
4. Enable the email provider under Authentication.
5. Add `workoutpal://auth/callback` to Authentication → URL Configuration → Redirect URLs.
6. Add the project URL and publishable key to `.env`, then restart Expo.

All user tables have Row Level Security enabled. Local changes are written to SQLite first, queued durably, and pushed after sign-in or network recovery. Newer remote records are merged back into the local database.

## Validation

```bash
npm run typecheck
npm test
npx expo export --platform ios
```

Local notification behavior should be verified on a physical iPhone or development build.

## Connected development project

The local CLI is linked to `aafxbjevyxrpgyxikxrg` (WorkoutPal, US East).
The ignored `.env` contains the project URL and publishable key.
On September 7, 2026, the seven tables and 78 catalog exercises were verified,
the security advisor returned no issues, and transaction-only two-user RLS checks passed. On September 10, authenticated application push and pull completed successfully against the linked project.

Run the database isolation checks against this project with:

```bash
npx supabase db query --linked --file supabase/tests/rls.sql
```

The fixtures are rolled back. The test checks owner visibility and updates,
cross-owner reads/updates/deletes, ownership reassignment, and cross-owner child inserts.

Supabase Auth allows `workoutpal://auth/callback` for native development builds.
If a LAN Expo callback is needed, use the current machine IP rather than assuming
the previously used address. Do not push the generated local
`supabase/config.toml` wholesale to the hosted project.

## TestFlight and App Store

After signing in to Expo and configuring the EAS project:

```bash
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

Update the provisional bundle identifier in `app.json` before the first App Store build if a different identifier is desired.
