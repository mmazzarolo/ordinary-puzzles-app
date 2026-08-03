import { difficulties } from "./difficulties";
import { GeneratorGame } from "./game";
import { Rng } from "./rng";
import {
  buildPuzzleRecord,
  classifyGame,
  createCandidateGameResult,
  createCandidateGameResultAsync,
  optimizeGameResult,
  optimizeGameResultAsync,
} from "./solver";
import {
  GeneratePuzzleAsyncOptions,
  GeneratePuzzleProfile,
  GeneratePuzzleOptions,
} from "./types";

export { difficulties } from "./difficulties";
export { GeneratorGame } from "./game";
export { hashSeed, Rng } from "./rng";
export {
  addForcedSquares,
  classifyGame,
  collectionScore,
  createCandidateGame,
  createCandidateGameResult,
  createEmptyClassification,
  optimizationScore,
  optimizeGame,
  optimizeGameResult,
} from "./solver";
export type {
  Classification,
  DifficultySpec,
  DifficultyVariant,
  GeneratePuzzleAsyncOptions,
  GeneratePuzzleProfile,
  GeneratePuzzleOptions,
  PuzzleRecord,
  PuzzleRows,
} from "./types";

const defaultYieldToEventLoop = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

export const createGeneratePuzzleProfile = (): GeneratePuzzleProfile => ({
  candidateAttempts: 0,
  classifications: 0,
  optimizationIterations: 0,
  rejectedCandidatesWithoutAdvancedDeduction: 0,
  rejectedUnacceptedPuzzles: 0,
  solvedCandidates: 0,
  topLevelAttempts: 0,
});

export const generatePuzzle = (options: GeneratePuzzleOptions) => {
  const spec = difficulties[options.mode];
  if (!spec) {
    throw new Error(`Unknown puzzle difficulty "${options.mode}"`);
  }

  const rng = new Rng(options.seed);
  const attemptLimit = options.attemptLimit ?? 100;
  const candidateAttemptLimit = options.candidateAttemptLimit ?? 1000;
  const requireAdvancedCandidate =
    options.requireAdvancedCandidate ?? spec.requireAdvancedCandidate ?? false;

  for (let attempt = 0; attempt < attemptLimit; attempt++) {
    if (options.profile) options.profile.topLevelAttempts++;
    const selectedVariant = rng.pick(spec.variants);
    const variant = {
      ...selectedVariant,
      optimizeIterations:
        options.optimizeIterations ?? selectedVariant.optimizeIterations,
    };
    const candidate = createCandidateGameResult(
      variant,
      rng,
      candidateAttemptLimit,
      {
        profile: options.profile,
        requireAdvancedDeduction: requireAdvancedCandidate,
      },
    );
    if (!candidate) continue;

    const optimized = optimizeGameResult(
      candidate.game,
      variant,
      rng,
      options.profile,
      candidate.classification,
    );
    if (!spec.accepts(optimized.classification)) {
      if (options.profile) options.profile.rejectedUnacceptedPuzzles++;
      continue;
    }

    return buildPuzzleRecord({
      classification: optimized.classification,
      game: optimized.game,
      profile: options.profile,
      spec,
      seed: options.seed,
      attempt,
    });
  }

  return undefined;
};

export const generatePuzzleAsync = async (
  options: GeneratePuzzleAsyncOptions,
) => {
  const spec = difficulties[options.mode];
  if (!spec) {
    throw new Error(`Unknown puzzle difficulty "${options.mode}"`);
  }

  const rng = new Rng(options.seed);
  const attemptLimit = options.attemptLimit ?? 100;
  const candidateAttemptLimit = options.candidateAttemptLimit ?? 1000;
  const yieldToEventLoop = options.yieldToEventLoop ?? defaultYieldToEventLoop;
  const yieldEveryAttempts = options.yieldEveryAttempts ?? 1;
  const candidateYieldEveryAttempts = options.candidateYieldEveryAttempts ?? 25;
  const optimizeYieldEveryIterations =
    options.optimizeYieldEveryIterations ?? 10;
  const requireAdvancedCandidate =
    options.requireAdvancedCandidate ?? spec.requireAdvancedCandidate ?? false;

  for (let attempt = 0; attempt < attemptLimit; attempt++) {
    if (options.profile) options.profile.topLevelAttempts++;
    const selectedVariant = rng.pick(spec.variants);
    const variant = {
      ...selectedVariant,
      optimizeIterations:
        options.optimizeIterations ?? selectedVariant.optimizeIterations,
    };
    const candidate = await createCandidateGameResultAsync(
      variant,
      rng,
      candidateAttemptLimit,
      {
        profile: options.profile,
        requireAdvancedDeduction: requireAdvancedCandidate,
      },
      {
        yieldEveryIterations: candidateYieldEveryAttempts,
        yieldToEventLoop,
      },
    );
    if (!candidate) {
      if ((attempt + 1) % yieldEveryAttempts === 0) await yieldToEventLoop();
      continue;
    }

    const optimized = await optimizeGameResultAsync(
      candidate.game,
      variant,
      rng,
      options.profile,
      {
        yieldEveryIterations: optimizeYieldEveryIterations,
        yieldToEventLoop,
      },
      candidate.classification,
    );
    if (!spec.accepts(optimized.classification)) {
      if (options.profile) options.profile.rejectedUnacceptedPuzzles++;
      if ((attempt + 1) % yieldEveryAttempts === 0) await yieldToEventLoop();
      continue;
    }

    return buildPuzzleRecord({
      classification: optimized.classification,
      game: optimized.game,
      profile: options.profile,
      spec,
      seed: options.seed,
      attempt,
    });
  }

  return undefined;
};

export const classifyRows = (rows: string[]) =>
  classifyGame(GeneratorGame.fromRows(rows));
