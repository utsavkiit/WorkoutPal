# Local iOS end-to-end tests

These Detox tests drive the native app on an iOS Simulator. They use the real
SQLite database, exercise catalog, navigation, and UI. No Metro, Expo Go, EAS,
or cloud testing subscription is needed.

## Setup

Install Xcode and an iOS Simulator runtime through Xcode Settings → Components.
Keep several GB of free disk space for native builds and simulator startup. The
build targets the host Mac architecture to avoid compiling unused simulator slices.
Use the repository's supported Node version and install dependencies:

```sh
npm ci
brew tap wix/brew
brew install wix/brew/applesimutils
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --project-directory=ios
```

If Homebrew asks you to trust the formula, review the Wix tap and run
`brew trust --formula wix/brew/applesimutils`, then repeat the install.

## Run

```sh
npm run e2e:setup:ios
npm run e2e:build:ios
npm run e2e:ios
```

Run setup again after changing Xcode or Detox to rebuild its native driver cache.

Or run build and tests with `npm run e2e:ios:all`. Rebuild after any app changes: the Release
app contains its JavaScript bundle and does not pick up Metro updates.

The default device type is `iPhone 16`. To select another installed type:

```sh
DETOX_DEVICE_TYPE='iPhone 16 Pro' npm run e2e:ios
```

Use `xcrun simctl list devices available` to inspect installed simulators. Detox
manages its simulator; the runner uses one worker. It does not target your phone.
Each test uninstalls/reinstalls the app on that simulator to reset SQLite and
preferences. Restart steps inside a test retain that data.

The build script disables Expo dotenv loading and blanks the two public cloud
configuration variables. Tests therefore run in local-only mode, without using
personal accounts or writing cloud records. The script also enables deterministic
local Coach fixtures so recommendation adoption can be exercised without a live
account; normal development and Release builds do not include those records. Do
not substitute your regular development binary for the E2E binary.

## Coverage

- Log a weighted set, finish a workout, inspect its history, terminate and relaunch,
  and verify the saved weight/reps.
- Recover a completed set in an active workout after termination; finish it,
  cancel an unsaved history edit, save corrected name/weight/reps, and verify
  those corrections after another restart.
- Open a pending Coach recommendation, accept it into a distinct saved routine,
  start the prescribed workout, verify active-workout recovery after restart by
  tapping the full in-progress card, and discard the zero-set workout from the
  always-visible Finish action.

This suite does not establish authenticated sync correctness, network recovery,
notification delivery, or physical-device accessibility. Those checks remain on
the Kanban board. Notification permission is denied for these logging tests.

## Failures

Detox saves logs and failure screenshots under ignored `artifacts/detox/`.
Use `npm run e2e:ios -- --loglevel debug` for more diagnostics. Native build
products are isolated under ignored `ios/build-detox/`.

Keep explicit assertions around saved values and restart behavior. Prefer stable
accessibility labels/test IDs; do not replace persistence checks with arbitrary
sleep calls or globally disable synchronization to hide a failure.

## Latest validation (November 25, 2026)

The Release simulator build and all three UI journeys pass. Supporting validation
also passes: TypeScript, 55 unit tests, and an iOS export. The Coach journey covers
the local proposal decision, saved-routine creation, workout start, process
termination, relaunch, active-workout recovery, and zero-set discard.
