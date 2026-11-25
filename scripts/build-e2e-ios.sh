#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Build a self-contained local-only app; never embed developer cloud credentials.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
export EXPO_NO_DOTENV=1
export EXPO_PUBLIC_SUPABASE_URL='' EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=''
export NODE_ENV=production
xcodebuild -workspace ios/WorkoutPal.xcworkspace -scheme WorkoutPal \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build-detox ARCHS="$(uname -m)" ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO build
