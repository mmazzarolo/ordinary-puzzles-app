import { Classification, DifficultySpec, DifficultyVariant } from "./types";

const baseVariant = (
  variant: Omit<
    DifficultyVariant,
    "scoreSingleSolution" | "scoreUncontestedNoCover" | "optimizeIterations"
  > &
    Partial<
      Pick<
        DifficultyVariant,
        "scoreSingleSolution" | "scoreUncontestedNoCover" | "optimizeIterations"
      >
    >,
): DifficultyVariant => ({
  scoreSingleSolution: -50,
  scoreUncontestedNoCover: -1,
  optimizeIterations: 100,
  ...variant,
});

const range = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const withoutAdvancedRules = (classification: Classification) =>
  classification.square.depth === 0 &&
  classification.dep.depth === 0 &&
  classification.oneOf.depth === 0;

export const difficulties: Record<string, DifficultySpec> = {
  small: {
    mode: "small",
    variants: range(7, 10).flatMap((pieces) => [
      baseVariant({
        height: 9,
        optimizeIterations: 0,
        width: 6,
        pieces,
        scoreCover: 1,
        scoreCantFit: 1,
        scoreSquare: 0,
        scoreDep: 0,
        scoreOneOf: 0,
        scoreMaxWidth: -1,
      }),
      baseVariant({
        height: 9,
        optimizeIterations: 0,
        width: 6,
        pieces,
        scoreCover: 1,
        scoreCantFit: 3,
        scoreSquare: 0,
        scoreDep: 0,
        scoreOneOf: 0,
        scoreMaxWidth: -1,
      }),
    ]),
    accepts: (classification) =>
      classification.solved &&
      classification.cover.depth > 1 &&
      withoutAdvancedRules(classification),
    collectionScoreBonus: (classification) =>
      classification.cantFit.depth * 1.25,
  },
  medium: {
    mode: "medium",
    variants: range(15, 20).map((pieces) =>
      baseVariant({
        height: 10,
        optimizeIterations: 25,
        width: 7,
        pieces,
        scoreCover: 1,
        scoreCantFit: 3,
        scoreSquare: 0,
        scoreDep: 0,
        scoreOneOf: 0,
        scoreMaxWidth: -1,
      }),
    ),
    accepts: (classification) =>
      classification.solved &&
      classification.cover.depth > 5 &&
      withoutAdvancedRules(classification),
    collectionScoreBonus: (classification) =>
      classification.cantFit.depth * 1.1,
  },
  large: {
    mode: "large",
    variants: range(19, 22).map((pieces) =>
      baseVariant({
        height: 11,
        optimizeIterations: 50,
        width: 8,
        pieces,
        scoreCover: 1,
        scoreCantFit: 3,
        scoreSquare: 50,
        scoreDep: 0,
        scoreOneOf: 0,
        scoreMaxWidth: -2,
      }),
    ),
    accepts: (classification) =>
      classification.solved &&
      classification.square.depth > 0 &&
      classification.dep.depth === 0 &&
      classification.oneOf.depth === 0,
    requireAdvancedCandidate: true,
  },
  expert: {
    mode: "expert",
    variants: range(23, 26).map((pieces) =>
      baseVariant({
        height: 13,
        optimizeIterations: 50,
        width: 9,
        pieces,
        scoreCover: 1,
        scoreCantFit: 3,
        scoreSquare: 50,
        scoreDep: 100,
        scoreOneOf: 60,
        scoreMaxWidth: -2,
      }),
    ),
    accepts: (classification) => classification.solved,
    collectionScoreBonus: () => 1,
    requireAdvancedCandidate: true,
  },
};
