export type PuzzleRows = string[];

export interface PuzzleRecord {
  id: string;
  rows: PuzzleRows;
  height: number;
  width: number;
  score: number;
  classification: Classification;
  seed: number;
}

export type DeductionKind =
  | "none"
  | "cover"
  | "cant_fit"
  | "square"
  | "dependency"
  | "one_of"
  | "single_solution"
  | "uncontested_no_cover";

export interface SolutionMetaData {
  depth: number;
  maxWidth: number;
}

export interface Classification {
  all: SolutionMetaData;
  oneOf: SolutionMetaData;
  dep: SolutionMetaData;
  square: SolutionMetaData;
  cantFit: SolutionMetaData;
  cover: SolutionMetaData;
  singleSolution: SolutionMetaData;
  uncontestedNoCover: SolutionMetaData;
  solved: boolean;
}

export interface DifficultyVariant {
  height: number;
  width: number;
  pieces: number;
  scoreCover: number;
  scoreCantFit: number;
  scoreSquare: number;
  scoreDep: number;
  scoreOneOf: number;
  scoreMaxWidth: number;
  scoreSingleSolution: number;
  scoreUncontestedNoCover: number;
  optimizeIterations: number;
}

export interface DifficultySpec {
  mode: string;
  variants: DifficultyVariant[];
  accepts: (classification: Classification) => boolean;
  collectionScoreBonus?: (classification: Classification) => number;
  requireAdvancedCandidate?: boolean;
}

export interface GeneratePuzzleProfile {
  candidateAttempts: number;
  classifications: number;
  optimizationIterations: number;
  rejectedCandidatesWithoutAdvancedDeduction: number;
  rejectedUnacceptedPuzzles: number;
  solvedCandidates: number;
  topLevelAttempts: number;
}

export interface GeneratePuzzleOptions {
  seed: number;
  mode: string;
  attemptLimit?: number;
  candidateAttemptLimit?: number;
  optimizeIterations?: number;
  profile?: GeneratePuzzleProfile;
  requireAdvancedCandidate?: boolean;
}

export interface GeneratePuzzleAsyncOptions extends GeneratePuzzleOptions {
  candidateYieldEveryAttempts?: number;
  optimizeYieldEveryIterations?: number;
  yieldEveryAttempts?: number;
  yieldToEventLoop?: () => Promise<void>;
}
