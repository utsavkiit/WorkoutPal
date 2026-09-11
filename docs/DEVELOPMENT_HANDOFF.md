# WorkoutPal development handoff

This file contains the reproducible local workflow and current technical state. Read it with `AGENTS.md` before resuming work.

## Current stack and decisions

- Expo SDK 54, React Native 0.81.5, React 19.1, Expo Router 6, and TypeScript 5.9.
- SQLite is the immediate source of truth. Supabase Auth and Postgres provide cloud backup and synchronization through a durable local outbox.
- Development builds are signed and installed locally with Xcode 16.4. EAS, TestFlight, and Expo Go are outside the normal development loop.
- iOS bundle ID is `com.utsavmehta.workoutpal`; Apple team ID is `N6Y7G2993R`.
- The generated native project is committed. Open `ios/WorkoutPal.xcworkspace`. Avoid `expo prebuild --clean` unless native regeneration is intentional because it can replace the Podfile locale fix.

## Install and validate

```bash
npm install
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --project-directory=ios
npm run typecheck
npm test
npx expo export --platform ios
```

The expected unit-test count is four. After dependency changes, also run `npx expo-doctor` and address all actionable SDK compatibility findings.

## Build and run on the development iPhone

List available devices instead of assuming the saved identifier is still valid:

```bash
xcrun devicectl list devices
```

Build from Xcode, or use this pattern with the physical device UDID returned above:

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 xcodebuild \
  -workspace ios/WorkoutPal.xcworkspace \
  -scheme WorkoutPal \
  -configuration Debug \
  -destination 'id=<DEVICE_UDID>' \
  -derivedDataPath /private/tmp/WorkoutPalDerivedData \
  -allowProvisioningUpdates build
```

Install the resulting app with the CoreDevice identifier from `devicectl list devices`:

```bash
xcrun devicectl device install app \
  --device <CORE_DEVICE_ID> \
  /private/tmp/WorkoutPalDerivedData/Build/Products/Debug-iphoneos/WorkoutPal.app
```

Start Metro while the Mac and iPhone share a network:

```bash
npx expo start --dev-client --lan
```

Open WorkoutPal normally, or launch it with a deep link using the Mac's current LAN IP:

```bash
xcrun devicectl device process launch \
  --device <CORE_DEVICE_ID> \
  --terminate-existing \
  --payload-url 'workoutpal://expo-development-client/?url=http%3A%2F%2F<MAC_LAN_IP>%3A8081' \
  com.utsavmehta.workoutpal
```

The iPhone must be unlocked, paired, in Developer Mode, and trusted. A cable is useful for initial installation; Metro can run over the same Wi-Fi afterward.

## Supabase

- Linked project ref: `aafxbjevyxrpgyxikxrg`.
- `.env` is ignored and must contain `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Never use a service-role key in the mobile application.
- Native auth redirect: `workoutpal://auth/callback`.
- Remote schema and RLS live in `supabase/migrations/001_workoutpal.sql`; deterministic catalog data lives in `supabase/seed.sql`.

Authenticate the Mac CLI when direct administrative queries are needed:

```bash
npx supabase login --agent no
npx supabase projects list
```

Run the rollback-only RLS verification with:

```bash
npx supabase db query --linked --file supabase/tests/rls.sql
```

The app logs `[sync] Supabase push and pull completed` after an authenticated round trip. Sync startup is intentionally gated on SQLite readiness and serialized to prevent nested transactions. Supabase failures are retained in the outbox and logged with their returned message.

## Recent fixes and remaining work

- Fixed all local `workout_sets` inserts to name and supply the table's eight columns.
- Added a reachable full-width finish-workout action and constrained long workout titles.
- Fixed repeated Supabase auth subscriptions, duplicate session updates, concurrent sync calls, and startup sync before SQLite initialization.
- Direct CLI workout counting still requires completing the Mac's Supabase CLI login. App-level authenticated push and pull has succeeded.
- Still validate offline/online recovery, notification delivery, background behavior, accessibility, and the eventual TestFlight production path.
