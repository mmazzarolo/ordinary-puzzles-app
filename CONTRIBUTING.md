# Contributing to Ordinary Puzzles

PRs are welcome. When submitting a PR, please consider the following:

- We require tests and will most likely reject a PR if there are no tests.

- We are using [TypeScript](https://www.typescriptlang.org/index.html) and all development should be done in TypeScript.

- This project uses [Oxlint](https://oxc.rs) for linting and [Oxfmt](https://oxc.rs) for formatting. See more below.

## Running Ordinary Puzzles

1. Install the pinned package manager with Corepack and run `pnpm install`.
2. Keep the private assets project at `../ordinary-puzzles-assets`, or set
   `ORDINARY_PUZZLES_ASSETS_DIR` to its location. Build commands copy the three
   required Averta files into the ignored `assets/fonts` paths.
3. Run `pnpm run ios`, `pnpm run android`, or `pnpm run web`.

For behavioral CI without the licensed font files, set
`ALLOW_FONT_FALLBACK=1`; release builds must not set this flag.

That's it! 🎉

## Testing

Ordinary Puzzles is being tested with [Jest](https://jestjs.io/docs/en/tutorial-react).  
For running the tests, run `pnpm run test:watch` to test as you develop, or `pnpm run test` for a single run.

The browser suite uses [Playwright](https://playwright.dev): run `pnpm run e2e`.

### Native tests

The device suite uses [Maestro](https://maestro.dev). Flows are in `.maestro/flows`,
and the shared steps are in `.maestro/subflows`.

Install the Maestro CLI, then build a test binary and run the flows:

```
pnpm run e2e:native:build:ios        # or e2e:native:build:android
pnpm run e2e:native:ios              # or e2e:native:android
```

The build scripts set `EXPO_PUBLIC_E2E_AUTO_SOLVE=1`. That flag makes each board
solve itself 500 ms after it appears, which keeps the flows short and removes
the need for hard-coded gestures. Release builds never set the flag.

Two flows carry the `interaction` tag. They drive the board with real gestures,
so they must not auto-solve. Test builds put a small control in the top left
corner of the home screen, and those flows tap it to turn auto-solve off for the
session. Its test id reports the state (`e2e-autosolve-on` or
`e2e-autosolve-off`), so a flow can both set the mode and confirm it. The same
binary therefore serves both kinds of flow.

Useful tags: `smoke` for the short set, `regression` for all of it, and `android`
for flows that need the hardware back key. iOS runs must exclude the `android`
tag.

## Linting

This project uses [Oxlint](https://oxc.rs) for linting and
[Oxfmt](https://oxc.rs) for formatting. Linting and formatting are separate: the
linter reports defects, and the formatter owns the layout.

Linting is type-aware, which is how it catches unhandled promises and misused
types. That needs the `oxlint-tsgolint` package, which `pnpm install` provides.
Suppress a rule with `// oxlint-disable-next-line <rule>`, and keep the reason
next to it.

```
pnpm run lint            # report problems
pnpm run lint:fix        # repair what can be repaired
pnpm run format          # format the repository
pnpm run format:check    # report files that need formatting
```

CI runs `format:check`, so unformatted code fails the build. Enable format on
save in your editor to avoid that.

Oxfmt uses the settings in `.oxfmtrc.json`. It skips `src/op-core/puzzles.json`,
because `scripts/inject-puzzle-ids.mjs` generates that file: a formatter and a
generator that disagree about the same file would fight on every run.
