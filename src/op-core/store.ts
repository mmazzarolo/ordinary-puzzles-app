import { createContext, useContext } from "react";
import {
  observable,
  action,
  computed,
  toJS,
  reaction,
  runInAction,
  makeObservable,
} from "mobx";
import { AppState } from "react-native";
import {
  appendSolveRecord,
  createEmptyPuzzleHistory,
  resolvePuzzleProgress,
  serializePuzzleProgress,
  rehydrateObject,
  persistObject,
  removeObject,
  pickNextPuzzleId,
  PuzzleIds,
  SolveRecord,
} from "op-utils";
// Imported from the store file directly (not the op-board barrel, which pulls
// in components that import op-core and would close an import cycle).
import { rootStore as boardRootStore, SavedBoardLine } from "op-board/store";
import uniq from "lodash/uniq";
import {
  getPackRecords,
  getPackRecordScore,
  isPackMode,
  packModes,
  PackMode,
  PackRecord,
} from "op-puzzle-pack";
import puzzles from "./puzzles.json";

export type Route =
  | "home"
  | "game"
  | "intro"
  | "tutorial"
  | "success"
  | "stats";
export type PuzzleMode = "tutorial" | PackMode;

const sum = (a: number, b: number) => a + b;

// The playable record, normalized across the two sources: the tutorial stays
// in puzzles.json; every real tier comes from the committed puzzle pack.
interface PlayableRecord {
  id: string;
  name: string;
  rows: string[] | null;
  score: number;
  rating: number;
  retired?: boolean;
  type: "puzzle" | "message";
  title?: string;
  message?: string;
}

const fromTutorial = (
  record: (typeof puzzles.tutorial)[number],
): PlayableRecord => ({
  id: record.id,
  name: record.name,
  rows: record.data,
  score: record.score || 0,
  rating: 0,
  type:
    (record as { type?: "puzzle" | "message" }).type === "message"
      ? "message"
      : "puzzle",
  title: (record as { title?: string }).title,
  message: (record as { message?: string }).message,
});

const fromPack = (record: PackRecord): PlayableRecord => ({
  id: record.id,
  name: record.name,
  rows: record.rows,
  score: getPackRecordScore(record),
  rating: record.rating,
  retired: record.retired,
  type: "puzzle",
});

const playableRecords: Record<PuzzleMode, PlayableRecord[]> = {
  tutorial: puzzles.tutorial.map(fromTutorial),
  small: getPackRecords("small").map(fromPack),
  medium: getPackRecords("medium").map(fromPack),
  large: getPackRecords("large").map(fromPack),
  extraordinary: getPackRecords("extraordinary").map(fromPack),
};

const buildLookup = <Value>(
  select: (record: PlayableRecord, index: number) => Value,
): Record<PuzzleMode, Map<string, Value>> =>
  Object.fromEntries(
    Object.entries(playableRecords).map(([mode, records]) => [
      mode,
      new Map(
        records.map((record, index) => [record.id, select(record, index)]),
      ),
    ]),
  ) as Record<PuzzleMode, Map<string, Value>>;

// The content-derived id is the stable puzzle identity: progress keyed by it
// survives catalog reordering AND renames. Names are display data only.
const puzzleIds: PuzzleIds = Object.fromEntries(
  Object.entries(playableRecords).map(([mode, records]) => [
    mode,
    records.map((record) => record.id),
  ]),
) as PuzzleIds;

const puzzleScoresById = buildLookup((record) => record.score);
const puzzleIndexById = buildLookup((_record, index) => index);

export { packModes, isPackMode };

class RouterStore {
  root: RootStore;

  currentRoute: Route;
  routesHistory = observable.array<Route>();

  constructor(rootStore: RootStore) {
    this.root = rootStore;
    this.currentRoute = "home";
    this.routesHistory.replace(["home"]);

    makeObservable(this, {
      currentRoute: observable,
      routesHistory: observable,
      hasLoadedHomeOnce: computed,
      changeRoute: action,
    });
  }

  get hasLoadedHomeOnce() {
    return (
      this.routesHistory.length > 1 &&
      this.routesHistory.filter((x) => x === "home").length > 1
    );
  }

  changeRoute(route: Route, puzzleMode?: PuzzleMode | "continue") {
    switch (route) {
      case "intro": {
        if (puzzleMode !== "continue") {
          this.root.puzzle.setRandomPuzzle(puzzleMode);
        }
        break;
      }
      case "tutorial": {
        this.root.puzzle.setPuzzle("tutorial", 0);
        break;
      }
      case "home":
      case "game":
      case "success":
      case "stats": {
        break;
      }
      default: {
        // The cases above are exhaustive, so the route narrows to "never" here.
        throw new Error(
          `"RouterStore.changeRoute » Invalid route ${String(route)}`,
        );
      }
    }
    this.currentRoute = route;
    this.routesHistory.push(route);
  }
}

class PuzzleStore {
  root: RootStore;

  mode?: PuzzleMode = undefined;
  index?: number = undefined;
  increasesScore: boolean = false;
  // Plain flag: whether the current deal was recorded as played.
  startedRecorded = false;

  constructor(rootStore: RootStore) {
    this.root = rootStore;
    this.increasesScore = false;

    makeObservable(this, {
      mode: observable,
      index: observable,
      increasesScore: observable,
      current: computed,
      name: computed,
      prefix: computed,
      id: computed,
      data: computed,
      type: computed,
      score: computed,
      isTutorialEnd: computed,
      tutorialTitle: computed,
      tutorialMessage: computed,
      setPuzzle: action,
      setRandomPuzzle: action,
      nextPuzzle: action,
      onPuzzleStarted: action,
      onPuzzleCompleted: action,
      restoreSavedBoard: action,
      reset: action,
    });
  }

  get current() {
    if (this.mode && this.index !== undefined) {
      return playableRecords[this.mode][this.index];
    } else {
      return undefined;
    }
  }

  get name() {
    return this.current?.name || "";
  }

  get prefix() {
    const modePrefix = {
      tutorial: "xs",
      small: "sm",
      medium: "md",
      large: "lg",
      extraordinary: "xo",
    };
    return this.mode ? modePrefix[this.mode] : "ko";
  }

  get id() {
    return this.current?.id || "";
  }

  get data() {
    return this.current?.rows;
  }

  get type() {
    return this.current?.type || "puzzle";
  }

  get score() {
    return this.current?.score || 0;
  }

  /* ===================
   * TUTORIAL
   * =================== */
  get isTutorialEnd() {
    return (
      this.mode === "tutorial" && this.index === puzzles.tutorial.length - 1
    );
  }

  get tutorialTitle() {
    return this.current?.title || "";
  }

  get tutorialMessage() {
    return this.current?.message || "";
  }

  /* ===================
   * GENERIC ACTIONS
   * =================== */
  setPuzzle(mode: PuzzleMode = this.mode || "small", index: number) {
    this.mode = mode;
    this.index = index;
    const id = puzzleIds[mode][index];
    // "Played" is recorded on the first committed line (onPuzzleStarted), not
    // at deal time: opening a puzzle and backing out costs nothing.
    this.startedRecorded = false;
    this.increasesScore =
      this.root.stats.completedPuzzles[mode]?.indexOf(id) === -1;
  }

  // The first committed line marks the puzzle as played.
  onPuzzleStarted() {
    if (this.startedRecorded) return;
    this.startedRecorded = true;
    this.root.stats.updatePlayedPuzzles(this.mode, this.id);
  }

  setRandomPuzzle(mode: PuzzleMode = this.mode || "small") {
    const id = pickNextPuzzleId({
      puzzles: playableRecords[mode],
      playedIds: this.root.stats.playedPuzzles[mode],
    });
    // The fallback honors the retired flag too: an undefined pick must never
    // resolve to a record the picker itself would refuse to serve.
    const firstServable = playableRecords[mode].findIndex(
      (record) => !record.retired,
    );
    const index =
      puzzleIndexById[mode].get(id ?? "") ??
      (firstServable === -1 ? 0 : firstServable);
    this.setPuzzle(mode, index);
  }

  nextPuzzle() {
    if (this.index !== undefined) this.index = this.index + 1;
  }

  onPuzzleCompleted() {
    const board = boardRootStore.board;
    // Completing implies playing, whichever path got the board solved.
    this.root.stats.updatePlayedPuzzles(this.mode, this.id);
    this.root.stats.updateCompletedPuzzles(this.mode, this.id);
    if (this.mode && this.id) {
      this.root.stats.recordSolve({
        id: this.id,
        mode: this.mode,
        at: Date.now(),
        ms: Math.round(board.elapsedMs),
        moves: board.commitCount,
        removals: board.removalCount,
        resumed: board.restoredFromStorage,
      });
    }
    // The solved board's snapshot is obsolete.
    void removeObject("boardState");
  }

  reset() {
    this.mode = undefined;
    this.index = undefined;
  }

  // Rebuilds the in-progress board saved by a previous session, so `continue`
  // survives a process death. Invalid snapshots are ignored silently.
  restoreSavedBoard(saved: unknown) {
    if (!saved || typeof saved !== "object") return;
    const snapshot = saved as {
      puzzleId?: unknown;
      mode?: unknown;
      lines?: unknown;
      elapsedMs?: unknown;
    };
    const mode = snapshot.mode;
    if (typeof snapshot.puzzleId !== "string" || typeof mode !== "string") {
      return;
    }
    // The tutorial has its own guided flow and is never snapshotted.
    if (mode === "tutorial" || !(mode in playableRecords)) return;
    const typedMode = mode as PuzzleMode;
    const index = puzzleIndexById[typedMode].get(snapshot.puzzleId);
    if (index === undefined) return;
    const record = playableRecords[typedMode][index];
    if (!record.rows || record.retired || !Array.isArray(snapshot.lines)) {
      return;
    }
    this.setPuzzle(typedMode, index);
    const board = boardRootStore.board;
    board.initialize(record.id, record.rows);
    board.restoreCommittedLines(
      snapshot.lines as SavedBoardLine[],
      typeof snapshot.elapsedMs === "number" ? snapshot.elapsedMs : 0,
    );
  }
}

class StatsStore {
  root: RootStore;

  initialized: boolean;
  playedPuzzles: Record<PuzzleMode, string[]>;
  completedPuzzles: Record<PuzzleMode, string[]>;
  // Passthrough ids this build's catalog does not know (see puzzleHistory.ts).
  // Plain fields: never rendered, only re-serialized on write.
  unknownPlayedPuzzles: Record<PuzzleMode, string[]>;
  unknownCompletedPuzzles: Record<PuzzleMode, string[]>;
  // Raw per-solve history (plain field: appended and persisted, never
  // rendered by the current screens).
  solves: SolveRecord[];
  // True when the stored document cannot be safely rewritten by this build
  // (written by a newer version, or the storage read itself failed).
  progressReadOnly: boolean;

  constructor(rootStore: RootStore) {
    this.root = rootStore;
    this.initialized = false;
    this.playedPuzzles = createEmptyPuzzleHistory();
    this.completedPuzzles = createEmptyPuzzleHistory();
    this.unknownPlayedPuzzles = createEmptyPuzzleHistory();
    this.unknownCompletedPuzzles = createEmptyPuzzleHistory();
    this.solves = [];
    this.progressReadOnly = false;

    makeObservable(this, {
      initialized: observable,
      playedPuzzles: observable,
      completedPuzzles: observable,
      initializeStore: action,
      score: computed,
      tutorialCompleted: computed,
      markTutorialCompleted: action,
      recordSolve: action,
      updateCompletedPuzzles: action,
      updatePlayedPuzzles: action,
    });
  }

  async initializeStore() {
    // A failed read is not an absent document: it must never lead to
    // overwriting possibly-intact storage with an empty history.
    let readFailed = false;
    const guard = (promise: Promise<unknown>) =>
      promise.catch(() => {
        readFailed = true;
        return undefined;
      });
    const [stored, legacyPlayed, legacyCompleted, savedBoard] =
      await Promise.all([
        guard(rehydrateObject("puzzleProgress")),
        guard(rehydrateObject("playedPuzzles")),
        guard(rehydrateObject("completedPuzzles")),
        guard(rehydrateObject("boardState")),
      ]);
    const progress = resolvePuzzleProgress({
      stored,
      legacyPlayed,
      legacyCompleted,
      puzzleIds,
      readFailed,
    });
    this.unknownPlayedPuzzles = progress.unknownPlayed;
    this.unknownCompletedPuzzles = progress.unknownCompleted;
    this.solves = progress.solves;
    this.progressReadOnly = progress.readOnly;
    runInAction(() => {
      this.playedPuzzles = progress.played;
      this.completedPuzzles = progress.completed;
      this.initialized = true;
    });
    this.root.puzzle.restoreSavedBoard(savedBoard);
  }

  get score() {
    const _score = (Object.keys(this.completedPuzzles) as PuzzleMode[])
      .map((mode) => {
        return this.completedPuzzles[mode]
          .map((id) => puzzleScoresById[mode].get(id) || 0)
          .reduce(sum, 0);
      })
      .reduce(sum, 0);

    return _score;
  }

  get tutorialCompleted() {
    return this.completedPuzzles["tutorial"].length > 0;
  }

  recordSolve(record: SolveRecord) {
    this.solves = appendSolveRecord(this.solves, record);
    this.persistProgress();
  }

  markTutorialCompleted() {
    this.updateCompletedPuzzles("tutorial", puzzleIds.tutorial[0]);
  }

  updateCompletedPuzzles(mode?: PuzzleMode, name?: string) {
    if (mode && name) {
      this.completedPuzzles[mode] = uniq(
        this.completedPuzzles[mode] || [],
      ).filter((x) => x !== name);
      this.completedPuzzles[mode].push(name);
      this.persistProgress();
    }
  }

  updatePlayedPuzzles(mode?: PuzzleMode, name?: string) {
    if (mode && name) {
      this.playedPuzzles[mode] = uniq(this.playedPuzzles[mode] || []).filter(
        (x) => x !== name,
      );
      this.playedPuzzles[mode].push(name);
      this.persistProgress();
    }
  }

  // The current schema is written only here, on real progress updates: a pure
  // load never rewrites storage, so downgrading the app keeps legacy data.
  persistProgress() {
    // Writes stop entirely when the stored document is not safely rewritable
    // by this build (newer schema version, or a failed read).
    if (this.progressReadOnly) return;
    // Fire and forget, which is what both callers have always expected. A
    // failed write therefore loses that one update without a report.
    void persistObject(
      "puzzleProgress",
      serializePuzzleProgress({
        played: toJS(this.playedPuzzles),
        completed: toJS(this.completedPuzzles),
        unknownPlayed: this.unknownPlayedPuzzles,
        unknownCompleted: this.unknownCompletedPuzzles,
        solves: this.solves,
      }),
    );
  }
}

class RootStore {
  puzzle: PuzzleStore;
  router: RouterStore;
  stats: StatsStore;

  constructor() {
    this.puzzle = new PuzzleStore(this);
    this.router = new RouterStore(this);
    this.stats = new StatsStore(this);
    this.wireBoardPersistence();
  }

  // Every committed change (or undo) flushes the board snapshot, and the
  // first committed line of a deal marks the puzzle as played.
  wireBoardPersistence() {
    const board = boardRootStore.board;
    reaction(
      () => board.history.length,
      () => {
        if (board.commitCount > 0) this.puzzle.onPuzzleStarted();
        this.persistBoardSnapshot();
      },
    );

    let backgroundedAt: number | undefined;
    AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (backgroundedAt !== undefined) {
          board.backgroundMs += Date.now() - backgroundedAt;
          backgroundedAt = undefined;
        }
      } else if (backgroundedAt === undefined) {
        backgroundedAt = Date.now();
        // Flush before the OS can kill the process.
        this.persistBoardSnapshot();
      }
    });
  }

  persistBoardSnapshot = () => {
    const board = boardRootStore.board;
    const mode = this.puzzle.mode;
    if (!board.isInitialized || !board.puzzleId || !mode) return;
    if (mode === "tutorial") return;
    void persistObject("boardState", {
      puzzleId: board.puzzleId,
      mode,
      lines: board.serializeCommittedLines(),
      elapsedMs: Math.round(board.elapsedMs),
      savedAt: Date.now(),
    });
  };

  // An arrow property, because "storesContext" below passes this method as a
  // value. A plain class method would arrive unbound and lose its receiver.
  initializeStore = async () => {
    await this.stats.initializeStore();
  };
}

const rootStore = new RootStore();

export const storesContext = createContext({
  initializeStore: rootStore.initializeStore,
  puzzle: rootStore.puzzle,
  router: rootStore.router,
  stats: rootStore.stats,
});

export const useCoreStores = () => useContext(storesContext);
