# WorkoutPal

WorkoutPal is an offline-first iPhone workout logger built with Expo, React Native, TypeScript, SQLite, and Supabase. You can create routines, add custom exercises, log weight and reps, run a rest timer, and review workout history even without a network connection.

## Run locally

Requirements: Node.js 22.13 or newer and the Expo Go app, or Xcode for the iOS Simulator.

```bash
npm install
npm start
```

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

## TestFlight and App Store

After signing in to Expo and configuring the EAS project:

```bash
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

Update the provisional bundle identifier in `app.json` before the first App Store build if a different identifier is desired.
