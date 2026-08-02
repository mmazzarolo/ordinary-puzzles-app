import { createContext, useContext } from "react";
import {
  observable,
  action,
  computed,
  toJS,
  runInAction,
  makeObservable,
} from "mobx";
import {
  createEmptyPuzzleHistory,
  resolvePuzzleProgress,
  serializePuzzleProgress,
  rehydrateObject,
  persistObject,
  pickRandomPuzzle,
  PuzzleIds,
} from "op-utils";
import uniq from "lodash/uniq";
import puzzles from "./puzzles.json";

export type Route =
  | "home"
  | "game"
  | "intro"
  | "tutorial"
  | "success"
  | "stats";
export type PuzzleMode = "tutorial" | "small" | "medium" | "large";

const sum = (a: number, b: number) => a + b;

// The content-derived id (see scripts/inject-puzzle-ids.mjs) is the stable
// puzzle identity: progress keyed by it survives catalog reordering AND
// renames, which index- or name-keyed progress would not. Names are display
// data only.
const puzzleIds: PuzzleIds = {
  tutorial: puzzles.tutorial.map((puzzle) => puzzle.id),
  small: puzzles.small.map((puzzle) => puzzle.id),
  medium: puzzles.medium.map((puzzle) => puzzle.id),
  large: puzzles.large.map((puzzle) => puzzle.id),
};

const puzzleScoresById: Record<PuzzleMode, Map<string, number>> = {
  tutorial: new Map(puzzles.tutorial.map((p) => [p.id, p.score || 0])),
  small: new Map(puzzles.small.map((p) => [p.id, p.score || 0])),
  medium: new Map(puzzles.medium.map((p) => [p.id, p.score || 0])),
  large: new Map(puzzles.large.map((p) => [p.id, p.score || 0])),
};

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
        throw new Error(`"RouterStore.changeRoute » Invalid route ${route}`);
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
      onPuzzleCompleted: action,
      reset: action,
    });
  }

  get current() {
    if (this.mode && this.index !== undefined) {
      return puzzles[this.mode][this.index];
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
    };
    return this.mode ? modePrefix[this.mode] : "ko";
  }

  get id() {
    return this.current?.id || "";
  }

  get data() {
    return this.current?.data;
  }

  get type() {
    // @ts-ignore
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
    // @ts-ignore
    return this.current?.title || "";
  }

  get tutorialMessage() {
    // @ts-ignore
    return this.current?.message || "";
  }

  /* ===================
   * GENERIC ACTIONS
   * =================== */
  setPuzzle(mode: PuzzleMode = this.mode || "small", index: number) {
    this.mode = mode;
    this.index = index;
    const id = puzzleIds[mode][index];
    this.root.stats.updatePlayedPuzzles(mode, id);
    this.increasesScore =
      this.root.stats.completedPuzzles[mode]?.indexOf(id) === -1;
  }

  setRandomPuzzle(mode: PuzzleMode = this.mode || "small") {
    // pickRandomPuzzle still reasons in catalog indexes, so map the id-keyed
    // histories to indexes (dropping ids no longer in the catalog).
    const toIndexes = (ids: string[]) =>
      ids
        .map((id) => puzzleIds[mode].indexOf(id))
        .filter((index) => index !== -1);
    const randomPuzzleIndex = pickRandomPuzzle({
      allPuzzlesLength: puzzles[mode].length,
      playedHistory: toIndexes(this.root.stats.playedPuzzles[mode]),
      completedHistory: toIndexes(this.root.stats.completedPuzzles[mode]),
    });
    this.setPuzzle(mode, randomPuzzleIndex);
  }

  nextPuzzle() {
    if (this.index !== undefined) this.index = this.index + 1;
  }

  onPuzzleCompleted() {
    this.root.stats.updateCompletedPuzzles(this.mode, this.id);
  }

  reset() {
    this.mode = undefined;
    this.index = undefined;
  }
}

class StatsStore {
  root: RootStore;

  initialized: boolean;
  playedPuzzles: Record<PuzzleMode, string[]>;
  completedPuzzles: Record<PuzzleMode, string[]>;

  constructor(rootStore: RootStore) {
    this.root = rootStore;
    this.initialized = false;
    this.playedPuzzles = createEmptyPuzzleHistory();
    this.completedPuzzles = createEmptyPuzzleHistory();

    makeObservable(this, {
      initialized: observable,
      playedPuzzles: observable,
      completedPuzzles: observable,
      initializeStore: action,
      score: computed,
      tutorialCompleted: computed,
      markTutorialCompleted: action,
      updateCompletedPuzzles: action,
      updatePlayedPuzzles: action,
    });
  }

  async initializeStore() {
    const [stored, legacyPlayed, legacyCompleted] = await Promise.all([
      rehydrateObject("puzzleProgress").catch(() => undefined),
      rehydrateObject("playedPuzzles").catch(() => undefined),
      rehydrateObject("completedPuzzles").catch(() => undefined),
    ]);
    const progress = resolvePuzzleProgress({
      stored,
      legacyPlayed,
      legacyCompleted,
      puzzleIds,
    });
    runInAction(() => {
      this.playedPuzzles = progress.played;
      this.completedPuzzles = progress.completed;
      this.initialized = true;
    });
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
    persistObject(
      "puzzleProgress",
      serializePuzzleProgress(
        toJS(this.playedPuzzles),
        toJS(this.completedPuzzles),
      ),
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
  }

  async initializeStore() {
    await rootStore.stats.initializeStore();
  }
}

const rootStore = new RootStore();

export const storesContext = createContext({
  initializeStore: rootStore.initializeStore,
  puzzle: rootStore.puzzle,
  router: rootStore.router,
  stats: rootStore.stats,
});

export const useCoreStores = () => useContext(storesContext);
