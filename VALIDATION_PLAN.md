# Cross-platform validation plan

This plan treats web, iOS, and Android as three release artifacts backed by one
shared product contract: the same puzzle pack, navigation, progress semantics,
theme behavior, and release version.

## Supported platforms

| Platform   | Previous native project                       | Expo SDK 56 baseline                            | Dropped by this release       |
| ---------- | --------------------------------------------- | ----------------------------------------------- | ----------------------------- |
| Android    | minSdk 16 (Android 4.1+)                      | minSdk 24 (Android 7.0+), compile/target SDK 36 | API 16-23 (Android 4.1-6.0.1) |
| iOS/iPadOS | project target 9.0; CocoaPods target 10.0     | iOS/iPadOS 16.4+                                | iOS/iPadOS 9.0-16.3           |
| Web        | No explicit browser floor beyond Browserslist | `>0.2%`, not dead, excluding Opera Mini         | Browsers outside that policy  |

SDK 56 also requires the Xcode 26.4+ generation of the Apple toolchain. The
generated Android project uses build tools 36.0.0, NDK 27.1, and Kotlin 2.1.20.

## Milestone 1: deterministic build and data baseline

Goal: make every platform artifact reproducible and remove failures that can be
found without running product flows on devices.

- Pin the complete Expo SDK 56 dependency graph and require clean results from
  Expo dependency checks, Expo Doctor, and pnpm peer checks.
- Use app version 1.4.0, iOS build 14, and Android version code 8 so store
  upgrades are monotonic.
- Generate native projects from `app.json`; do not restore the deleted legacy
  native projects as hand-maintained source.
- Remove platform-resolution cycles and require production Metro exports for
  web, iOS, and Android.
- Give every puzzle pack a SHA-256 content identity. Persist progress in one
  schema-versioned, pack-versioned document rather than two independently
  written index maps.
- On a pack change, preserve tutorial progress and total historical solves, but
  reset generated-puzzle indices because indices do not identify the same
  puzzle across packs.
- Retain the pre-1.4 legacy keys as a rollback snapshot. New writes go only to
  the versioned document.
- Validate every generated puzzle's dimensions, row encoding, seed uniqueness,
  index sequence, score, pack hash, and expected mode counts.
- Require typecheck, lint, unit tests, production web E2E, Expo prebuild,
  Android debug compilation, and unsigned iOS Simulator compilation to pass.

Exit criteria: all checks above are green from a clean install, and remaining
native warnings are classified as upstream or local-toolchain debt rather than
app errors.

## Milestone 2: automated product flows

Goal: prove behavior, persistence, responsive layout, and web delivery without
depending on manual testing.

- Expand Playwright coverage across Chromium, WebKit, and Firefox, with desktop
  and representative mobile/tablet viewports.
- Cover first launch/tutorial, all four difficulty modes, reset/menu/back,
  puzzle completion, statistics, reload persistence, dark/light theme, and
  corrupted/legacy storage recovery.
- Add a deterministic test hook or fixture for selecting and completing a known
  puzzle. Do not encode tests around random pack indices.
- Test the service worker under a subpath: registration, scoped cache cleanup,
  reload after activation, offline navigation, cached assets, failed requests,
  and update recovery.
- Add visual snapshots at the smallest supported phone, a common phone, tablet,
  and narrow/wide browser layouts. Review intentional diffs rather than using
  snapshots as the only assertion.
- Fail on page errors, console errors, unhandled promises, missing assets, and
  unexpected network requests.

Exit criteria: the browser matrix and persistence/offline suites are stable in
CI and can reproduce failures with traces and screenshots.

### Milestone 2 implementation status

The local production-export matrix is green on Playwright's pinned Chromium,
Firefox, and WebKit builds. It currently exercises 75 project/test pairs: 73
pass and two are explicitly skipped because Playwright's protocol-level offline
mode prevents top-level Firefox/WebKit navigation before a service worker can
answer it. A two-repeat stability run completed with 146 passes and four
expected skips without retries.

Implemented coverage:

- pack-backed launch and deterministic completion for all four generated modes;
- complete tutorial traversal, tutorial persistence, one real pointer-drag
  solution, menu/reset/continue, generated completion, statistics, and reload
  persistence;
- browser Back from an active puzzle or statistics to Home, with Forward
  restoring the in-memory child view in every engine; transient
  intro/game/success transitions remain one history level below Home;
- legacy-key migration, malformed-document recovery, pack rollover, content ID,
  and rollback-key retention through the production app;
- 320x568 phone, 390x844 phone, 768x1024 tablet, and 1440x900 desktop layout
  bounds and reviewed per-engine visual baselines, plus live light/dark
  color-scheme changes;
- service-worker scope, selective legacy-cache cleanup, failed-response
  rejection, cache ownership, and an in-place v2-to-v3 payload update in all
  engines, plus a real offline reload in Chromium and server-level origin
  failure recovery in every engine;
- failure artifacts for page errors, console errors, failed same-origin
  requests/responses, screenshots, video, and traces;
- a pull-request/default-branch GitHub Actions gate that installs the pinned
  pnpm graph, runs typecheck/lint/unit tests, installs all three Playwright
  engines with Linux system dependencies, runs the production matrix with one
  worker, and retains reports, traces, screenshots, and video for 14 days.

Remaining before Milestone 2 exit:

- push the workflow and run the matrix repeatedly in the actual CI environment
  to record its flake rate; the workflow is configured locally, but the
  two-repeat local run remains only an initial stability signal.

### Running the browser matrix

Install the browser revisions pinned by the repository's Playwright version:

```sh
pnpm run e2e:install-browsers
```

Run the production `/play` export against all engines:

```sh
pnpm run e2e
```

Run one engine or one focused test while iterating:

```sh
pnpm run e2e -- --project=chromium
pnpm run e2e -- --project=webkit --grep "small opens"
```

The browser binaries live in the ignored `.playwright-browsers` directory. The
test server exports with `EXPO_PUBLIC_E2E_AUTO_SOLVE=1`; ordinary development
and release builds do not enable deterministic completion.

## Milestone 3: native runtime and device matrix

Goal: exercise the real native modules and OS lifecycle on the supported range.

- Build installable debug/test apps and run the shared black-box flow suite on
  iOS and Android (Maestro or an equivalent accessibility-driven runner).
- iOS matrix: 16.4 boundary simulator, current iOS simulator, small iPhone,
  large iPhone, and iPad; include at least one physical current-iOS device.
- Android matrix: API 24 boundary emulator, API 29/30 intermediate behavior,
  API 36 target emulator, small/large phones, and tablet; include at least one
  physical device from a major OEM.
- Exercise cold/warm launch, background/foreground, process kill and restore,
  orientation/window resizing where allowed, dark/light theme changes, audio,
  haptics, keep-awake, Android back, navigation/status bars, splash timing, and
  repeated rapid interactions.
- Run a low-memory/slow-start pass and inspect native logs for crashes, ANRs,
  rejected promises, missing modules, and layout warnings.

Exit criteria: all critical flows pass on the OS boundary and current OS, with
no unexplained native logs and no blocker visual defects.

### Milestone 3 implementation status

The native Release checkpoint is green on the locally available boundary,
target, forward-compatibility, phone, and tablet simulators:

- iPhone SE (3rd generation), iOS 17.0: clean Release build, install, cold
  launch, and visually reviewed Home render. The simulator logged no app crash
  or React/JavaScript fault; CoreSimulator/CoreAudio emitted infrastructure
  messages that still require a physical-device audio check.
- iPhone 17 Pro and iPad Pro 13-inch (M5), iOS/iPadOS 26.5: clean Release
  build, install, direct launch, foreground activity, reviewed portrait Home
  renders, and no app crash or React/JavaScript fault. The iPad keeps the
  product's narrow left-aligned column instead of expanding across the canvas;
  this is usable but remains a tablet-design review item.
- Pixel 6 AVD, Android 7.0/API 24: the target-36 Release APK installs and runs
  at the declared minimum. ADB completed Small, observed Completed, returned to
  Menu, verified persisted score `1`, and found no fatal app log. The measured
  process-cold launch was 926 ms. The legacy OS renders black system-bar bands,
  unlike the edge-to-edge current-Android result, so that visual difference is
  tracked explicitly.
- Pixel 6 AVD, Android 16/API 36: the Release APK passed the same completion,
  persistence, and fatal-log flow. Two successful process-cold runs measured
  2.07 and 4.56 seconds after the emulator's first-boot System UI recovered.
- Pixel 10 16 KB AVD, Android 17/API 37: clean Release build including
  `lintVitalRelease`, install, 1.46-second cold launch, Home, Small completion,
  menu return, persisted score, and fatal-log check. API 37 is forward-compat
  evidence, not a substitute for the supported API 24 boundary or API 36
  target.
- All shared buttons now expose a stable accessibility role, label, and
  `button-<label>` test ID. `pnpm run test:native:android` drives the Release
  APK through the flow above using ADB and the native UI hierarchy. It also
  suppresses the fresh-emulator immersive-mode explanation that otherwise
  hides the app hierarchy and reports blocking system ANR/crash dialogs
  directly instead of timing out on an app control.
- Android Release generation now pins `babel-preset-expo` explicitly and raises
  the generated Gradle JVM budget to 4 GiB heap/1 GiB metaspace. This fixes a
  hidden direct-Gradle bundle resolution failure and a release-lint metaspace
  failure found during this milestone.

Generate and run the Android Release smoke flow with a connected API 24+
emulator/device:

```sh
node_modules/.bin/expo prebuild --clean --no-install --platform android
NODE_ENV=production EXPO_PUBLIC_E2E_AUTO_SOLVE=1 \
  android/gradlew -p android app:assembleRelease --no-daemon
pnpm run test:native:android
```

Remaining before Milestone 3 exit: iOS 16.4 boundary and automated current-iOS
product flows; Android API 29/30 intermediate behavior and tablet layout; at
least one physical device per platform; and automated lifecycle, audio,
haptics, keep-awake, system Back, orientation/window resizing, low-memory, and
rapid-interaction coverage.

## Milestone 4: signed upgrade and release confidence

Goal: validate the path real users and stores will execute.

- Produce signed release candidates with production identifiers and settings.
- Install the last production version, create progress in every mode, upgrade
  in place to 1.4.0, and verify migration, score, tutorial state, and launch.
- Test an emergency forward-version rollback build against migrated storage.
- Validate App Store/TestFlight and Play internal-track packages, store metadata,
  privacy manifests, permissions, icons, splash screens, and bundle size.
- Run a staged beta soak with crash/ANR monitoring and explicit stop/go
  thresholds before wider rollout.

Exit criteria: signed in-place upgrades pass on both stores, rollback behavior
is understood, and the beta meets agreed reliability thresholds.

## Known risks to track

1. Real upgrade behavior still needs the previous signed iOS and Android builds;
   unit migration tests cannot reproduce store sandbox and keychain behavior.
2. Android API 24, 36, and 37 Release product flows and iOS 17/26.5 Release
   launches are green, but iOS 16.4, intermediate Android, automated iOS flows,
   and physical devices remain untested. The current evidence does not validate
   audio, haptics, keep-awake, or lifecycle behavior across the supported
   range.
3. Web service-worker registration, update takeover, cache ownership, and
   server-level origin failure are automated. Playwright still cannot perform
   protocol-level top-navigation offline emulation in Firefox/WebKit, so those
   two combinations remain explicit skips rather than false passes.
4. Some screens derive native scale from `Dimensions.get(...)`; tablet
   multitasking and live window-size changes need focused visual testing. The
   current iPad portrait render leaves substantial unused horizontal space.
5. SDK 56 dependencies emit Xcode 26.6 nullability/deprecation warnings and
   Gradle deprecation warnings. They are currently upstream, but should be
   reevaluated on each Expo patch and before a Gradle 10 migration.
6. The local Android SDK reports a command-line-tools XML version mismatch.
   Builds pass, but the local Android Studio/command-line-tools versions should
   be aligned to keep CI and developer machines reproducible.
7. The repository still contains an unused pre-Expo web entry point and CRA
   service-worker helper. They are not part of the Expo entry path, but should
   be removed or clearly archived to prevent future accidental reuse.
8. There is no evidence yet of production crash/ANR telemetry in the current
   app path; a staged rollout is weaker without it.
9. iOS 26.5 reports that the `UIScene` lifecycle will become mandatory in a
   future release. It is not a current launch failure, but the Expo-generated
   lifecycle must be reevaluated before the next iOS/Xcode baseline.
10. Android API 24 keeps black legacy status/navigation-bar bands while API 36
    renders edge-to-edge. This is not a functional blocker, but needs an
    explicit product decision and physical-device visual check.
