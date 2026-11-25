# Local iOS end-to-end tests

These Detox tests drive the native app on an iOS Simulator using the real SQLite database, navigation, and rendered controls. The Release test binary is self-contained and local-only: it does not use Metro, Expo Go, EAS, personal accounts, or cloud records.

## Run locally

```sh
npm ci
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --project-directory=ios
npm run e2e:setup:ios
npm run e2e:build:ios
npm run e2e:ios
```

The default device type is `iPhone 16`. Override it with `DETOX_DEVICE_TYPE` when needed. Each test reinstalls the app to reset its simulator sandbox; restart steps within a test retain SQLite data.

## Required coverage

The complete suite currently verifies:

- Start a workout, add an exercise, complete a weighted set, finish, inspect History, restart the process, and verify the saved workout remains correct.
- Terminate with an active workout, relaunch and resume it, finish, cancel an unsaved History edit, save corrected values, restart again, and verify the corrections persist.

Every feature that changes a user journey must extend this suite with its success path and its important failure/recovery path. Stable accessibility labels or test IDs are part of the product contract. Do not replace assertions with arbitrary sleeps or disabled synchronization.

This hosted suite does not prove authenticated Supabase sync, network recovery, notification delivery, physical-device signing, background behavior, or accessibility. When a feature touches those areas, the matching local iPhone or Supabase checks remain required merge blockers and must be recorded in `docs/KANBAN.md`.

Detox stores failure logs and screenshots under ignored `artifacts/detox/`; native build products are isolated under ignored `ios/build-detox/`.
