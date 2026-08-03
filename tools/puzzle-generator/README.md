# Puzzle Generator Tooling

This folder contains generator tooling for building puzzle packs outside the app
runtime.

## TypeScript Reference Generator

`ts-generator/` is the optimized TypeScript port used for tests, profiling, and
experiments. It is intentionally kept outside `src/` so it cannot become part of
the Expo app bundle by accident.

## Native Generator

`native_generator.cpp` is a C++ port of the current TypeScript generator core.
It is intended for offline batch generation, benchmarking, and behavior
comparison against the TypeScript generator. It is not wired into the Expo app.

Run the native benchmark from the repo root:

```sh
CI=1 pnpm run bench:native-generator -- --modes=medium,large --samples=10 --large-samples=2
```

Representative result on an Apple Silicon Mac:

| Mode               | Optimized TS |         C++ |
| ------------------ | -----------: | ----------: |
| medium, 10 samples |  ~216 ms avg |  ~46 ms avg |
| large, 2 samples   | ~1462 ms avg | ~260 ms avg |

The fixed-seed profile counters matched the TypeScript generator for these
runs, which makes this a good starting point for future puzzle-pack generation.

The C++ file also keeps small JSON/C ABI helpers. They are not used by the app
runtime; they are there so a future pack-generation tool can call the native
generator directly instead of parsing benchmark output.

Generate and measure a sample pack:

```sh
CI=1 pnpm run generate:puzzle-pack-sample -- --counts=small:50,medium:50,large:20,expert:10
```

Each pack record now carries (see `scripts/generate-puzzle-pack-sample.mjs`):

- `id` — the puzzle's content id (same rule as `scripts/puzzle-id.mjs`); this
  is the progress key, so it may never change for shipped content.
- `name` — a two-word display alias, unique per tier (rerolled on collision).
  Names are cosmetic and may change; identity lives in `id`.
- `techniques` — solver-classification depths (`cover`, `cantFit`, `square`,
  `dep`, `oneOf`, `uncontestedNoCover`, `singleSolution`, `maxWidth`) computed
  by the TypeScript reference solver for every emitted board. This feeds the
  unified difficulty rating at pack build (plan §10.4).
- `generatorScore` — the generator's internal optimization score (can be
  negative); diagnostic only, never player-facing.

The pack-level SHA-256 id is informational metadata. App progress is keyed by
the per-puzzle content ids, never by the pack id or by indices.

Measure experimental size/complexity combinations:

```sh
CI=1 pnpm run measure:generator-matrix -- --samples=2 --attempt-limit=30 --candidate-attempt-limit=500
```
