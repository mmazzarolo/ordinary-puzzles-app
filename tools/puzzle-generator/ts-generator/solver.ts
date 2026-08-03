import { GeneratorGame } from "./game";
import { Rng } from "./rng";
import {
  Classification,
  DifficultySpec,
  DifficultyVariant,
  GeneratePuzzleProfile,
  PuzzleRecord,
} from "./types";

interface YieldOptions {
  yieldEveryIterations?: number;
  yieldToEventLoop: () => Promise<void>;
}

const maybeYield = async (iteration: number, options?: YieldOptions) => {
  if (
    options?.yieldEveryIterations &&
    (iteration + 1) % options.yieldEveryIterations === 0
  ) {
    await options.yieldToEventLoop();
  }
};

const emptyMeta = () => ({ depth: 0, maxWidth: 0 });

export const createEmptyClassification = (): Classification => ({
  all: emptyMeta(),
  oneOf: emptyMeta(),
  dep: emptyMeta(),
  square: emptyMeta(),
  cantFit: emptyMeta(),
  cover: emptyMeta(),
  singleSolution: emptyMeta(),
  uncontestedNoCover: emptyMeta(),
  solved: false,
});

export const classifyGame = (
  input: GeneratorGame,
  profile?: GeneratePuzzleProfile,
) => {
  if (profile) profile.classifications++;
  const game = input.clone();
  const classification = createEmptyClassification();
  game.resetHints();

  while (true) {
    const result = game.iterate();
    if (result.kind === "none") return classification;

    switch (result.kind) {
      case "cover":
        classification.cover.depth++;
        classification.cover.maxWidth = Math.max(
          classification.cover.maxWidth,
          result.count,
        );
        break;
      case "cant_fit":
        classification.cantFit.depth++;
        classification.cantFit.maxWidth = Math.max(
          classification.cantFit.maxWidth,
          result.count,
        );
        break;
      case "square":
        classification.square.depth++;
        classification.square.maxWidth = Math.max(
          classification.square.maxWidth,
          result.count,
        );
        break;
      case "dependency":
        classification.dep.depth++;
        classification.dep.maxWidth = Math.max(
          classification.dep.maxWidth,
          result.count,
        );
        break;
      case "one_of":
        classification.oneOf.depth++;
        classification.oneOf.maxWidth = Math.max(
          classification.oneOf.maxWidth,
          result.count,
        );
        break;
      case "single_solution":
        classification.singleSolution.depth++;
        classification.singleSolution.maxWidth = Math.max(
          classification.singleSolution.maxWidth,
          result.count,
        );
        break;
      case "uncontested_no_cover":
        classification.uncontestedNoCover.depth++;
        classification.uncontestedNoCover.maxWidth = Math.max(
          classification.uncontestedNoCover.maxWidth,
          result.count,
        );
        break;
    }

    classification.all.depth++;
    classification.all.maxWidth = Math.max(
      classification.all.maxWidth,
      result.count,
    );

    if (game.solved()) {
      classification.solved = true;
      break;
    }
    if (game.impossible()) break;
  }

  return classification;
};

export const addForcedSquares = (input: GeneratorGame, rng: Rng) => {
  const game = input.clone();
  for (let index = 0; index < 100; index++) {
    game.forceIfUncontested(rng);
    const result = game.iterate();
    if (result.kind === "none") {
      if (!game.forceOneSquare(rng)) break;
    }
    if (game.impossible()) break;
  }
  return game;
};

export const optimizationScore = (
  classification: Classification,
  variant: DifficultyVariant,
) =>
  classification.cover.depth * variant.scoreCover +
  classification.cantFit.depth * variant.scoreCantFit +
  classification.square.depth * variant.scoreSquare +
  classification.dep.depth * variant.scoreDep +
  classification.oneOf.depth * variant.scoreOneOf +
  classification.singleSolution.depth * variant.scoreSingleSolution +
  classification.uncontestedNoCover.depth * variant.scoreUncontestedNoCover +
  classification.all.maxWidth * variant.scoreMaxWidth;

export const collectionScore = (
  classification: Classification,
  spec: DifficultySpec,
) =>
  (spec.collectionScoreBonus?.(classification) ?? 0) +
  classification.cover.depth +
  classification.cantFit.depth +
  classification.square.depth * 10 +
  classification.dep.depth * 50 +
  classification.oneOf.depth * 20 +
  classification.singleSolution.depth * -200 +
  classification.uncontestedNoCover.depth * -50 +
  classification.all.maxWidth * -2;

interface OptimizationResult {
  game: GeneratorGame;
  classification: Classification;
  score: number;
}

export interface CandidateResult {
  game: GeneratorGame;
  classification: Classification;
}

interface CandidateSearchOptions {
  profile?: GeneratePuzzleProfile;
  requireAdvancedDeduction?: boolean;
}

const hasAdvancedDeduction = (classification: Classification) =>
  classification.square.depth > 0 ||
  classification.oneOf.depth > 0 ||
  classification.dep.depth > 0;

const pushOptimizationResult = (
  results: OptimizationResult[],
  result: OptimizationResult,
) => {
  const index = results.findIndex((current) => result.score > current.score);
  if (index === -1) {
    if (results.length < 10) results.push(result);
  } else {
    results.splice(index, 0, result);
    if (results.length > 10) results.pop();
  }
};

export const optimizeGameResult = (
  input: GeneratorGame,
  variant: DifficultyVariant,
  rng: Rng,
  profile?: GeneratePuzzleProfile,
  initialClassification?: Classification,
) => {
  const iterations = variant.optimizeIterations;
  const firstClassification =
    initialClassification ?? classifyGame(input, profile);
  if (!iterations) {
    return {
      game: input.clone(),
      classification: firstClassification,
    };
  }

  const results: OptimizationResult[] = [
    {
      game: input.clone(),
      classification: firstClassification,
      score: optimizationScore(firstClassification, variant),
    },
  ];

  for (let index = 0; index < iterations; index++) {
    if (profile) profile.optimizationIterations++;
    const base = results[rng.int(results.length)].game.clone();
    base.resetForced();
    base.mutate(rng);
    const optimized = addForcedSquares(base, rng);
    const classification = classifyGame(optimized, profile);

    if (classification.solved) {
      pushOptimizationResult(results, {
        game: optimized,
        classification,
        score: optimizationScore(classification, variant),
      });
    }
  }

  return {
    game: results[0].game.clone(),
    classification: results[0].classification,
  };
};

export const optimizeGame = (
  input: GeneratorGame,
  variant: DifficultyVariant,
  rng: Rng,
  profile?: GeneratePuzzleProfile,
) => optimizeGameResult(input, variant, rng, profile).game;

export const optimizeGameResultAsync = async (
  input: GeneratorGame,
  variant: DifficultyVariant,
  rng: Rng,
  profile?: GeneratePuzzleProfile,
  yieldOptions?: YieldOptions,
  initialClassification?: Classification,
) => {
  const iterations = variant.optimizeIterations;
  const firstClassification =
    initialClassification ?? classifyGame(input, profile);
  if (!iterations) {
    return {
      game: input.clone(),
      classification: firstClassification,
    };
  }

  const results: OptimizationResult[] = [
    {
      game: input.clone(),
      classification: firstClassification,
      score: optimizationScore(firstClassification, variant),
    },
  ];

  for (let index = 0; index < iterations; index++) {
    if (profile) profile.optimizationIterations++;
    const base = results[rng.int(results.length)].game.clone();
    base.resetForced();
    base.mutate(rng);
    const optimized = addForcedSquares(base, rng);
    const classification = classifyGame(optimized, profile);

    if (classification.solved) {
      pushOptimizationResult(results, {
        game: optimized,
        classification,
        score: optimizationScore(classification, variant),
      });
    }

    await maybeYield(index, yieldOptions);
  }

  return {
    game: results[0].game.clone(),
    classification: results[0].classification,
  };
};

export const optimizeGameAsync = async (
  input: GeneratorGame,
  variant: DifficultyVariant,
  rng: Rng,
  profile?: GeneratePuzzleProfile,
  yieldOptions?: YieldOptions,
) =>
  (await optimizeGameResultAsync(input, variant, rng, profile, yieldOptions))
    .game;

export const createCandidateGameResult = (
  variant: DifficultyVariant,
  rng: Rng,
  attemptLimit = 1000000,
  options: CandidateSearchOptions = {},
): CandidateResult | undefined => {
  for (let attempt = 0; attempt < attemptLimit; attempt++) {
    if (options.profile) options.profile.candidateAttempts++;
    const game = GeneratorGame.random({
      height: variant.height,
      width: variant.width,
      pieces: variant.pieces,
      rng,
    });
    const candidate = addForcedSquares(game, rng);

    if (candidate.solved()) {
      if (options.profile) options.profile.solvedCandidates++;
      const classification = classifyGame(candidate, options.profile);
      if (!classification.solved) continue;
      if (
        options.requireAdvancedDeduction &&
        !hasAdvancedDeduction(classification)
      ) {
        if (options.profile) {
          options.profile.rejectedCandidatesWithoutAdvancedDeduction++;
        }
        continue;
      }
      return {
        game: candidate,
        classification,
      };
    }
  }

  return undefined;
};

export const createCandidateGame = (
  variant: DifficultyVariant,
  rng: Rng,
  attemptLimit = 1000000,
  options: CandidateSearchOptions = {},
) => createCandidateGameResult(variant, rng, attemptLimit, options)?.game;

export const createCandidateGameResultAsync = async (
  variant: DifficultyVariant,
  rng: Rng,
  attemptLimit = 1000000,
  options: CandidateSearchOptions = {},
  yieldOptions?: YieldOptions,
): Promise<CandidateResult | undefined> => {
  for (let attempt = 0; attempt < attemptLimit; attempt++) {
    if (options.profile) options.profile.candidateAttempts++;
    const game = GeneratorGame.random({
      height: variant.height,
      width: variant.width,
      pieces: variant.pieces,
      rng,
    });
    const candidate = addForcedSquares(game, rng);

    if (candidate.solved()) {
      if (options.profile) options.profile.solvedCandidates++;
      const classification = classifyGame(candidate, options.profile);
      if (!classification.solved) {
        await maybeYield(attempt, yieldOptions);
        continue;
      }
      if (
        options.requireAdvancedDeduction &&
        !hasAdvancedDeduction(classification)
      ) {
        if (options.profile) {
          options.profile.rejectedCandidatesWithoutAdvancedDeduction++;
        }
        await maybeYield(attempt, yieldOptions);
        continue;
      }
      return {
        game: candidate,
        classification,
      };
    }

    await maybeYield(attempt, yieldOptions);
  }

  return undefined;
};

export const createCandidateGameAsync = async (
  variant: DifficultyVariant,
  rng: Rng,
  attemptLimit = 1000000,
  options: CandidateSearchOptions = {},
  yieldOptions?: YieldOptions,
) =>
  (
    await createCandidateGameResultAsync(
      variant,
      rng,
      attemptLimit,
      options,
      yieldOptions,
    )
  )?.game;

export const buildPuzzleRecord = (params: {
  classification?: Classification;
  game: GeneratorGame;
  spec: DifficultySpec;
  seed: number;
  attempt: number;
  profile?: GeneratePuzzleProfile;
}): PuzzleRecord => {
  const classification =
    params.classification ?? classifyGame(params.game, params.profile);
  return {
    id: `${params.spec.mode}:${params.seed}:${params.attempt}`,
    rows: params.game.toRows(),
    height: params.game.height,
    width: params.game.width,
    score: Math.floor(collectionScore(classification, params.spec)),
    classification,
    seed: params.seed,
  };
};
