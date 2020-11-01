import { createContext, useContext } from "react";
import {
  observable,
  action,
  computed,
  toJS,
  runInAction,
  makeObservable,
} from "mobx";
import { rehydrateObject, persistObject, pickRandomPuzzle } from "op-utils";
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
    return this.name;
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
    this.root.stats.updatePlayedPuzzles(mode, index);
    this.increasesScore =
      this.root.stats.completedPuzzles[this.mode]?.indexOf(this.index) === -1;
  }

  setRandomPuzzle(mode: PuzzleMode = this.mode || "small") {
    const randomPuzzleIndex = pickRandomPuzzle({
      allPuzzlesLength: puzzles[mode].length,
      playedHistory: this.root.stats.playedPuzzles[mode],
      completedHistory: this.root.stats.completedPuzzles[mode],
    });
    this.setPuzzle(mode, randomPuzzleIndex);
  }

  nextPuzzle() {
    if (this.index !== undefined) this.index = this.index + 1;
  }

  onPuzzleCompleted() {
    this.root.stats.updateCompletedPuzzles(this.mode, this.index);
  }

  reset() {
    this.mode = undefined;
    this.index = undefined;
  }
}

const emptyPuzzleHistory: Record<PuzzleMode, number[]> = {
  tutorial: [],
  small: [],
  medium: [],
  large: [],
};

class StatsStore {
  root: RootStore;

  initialized: boolean;
  playedPuzzles: Record<PuzzleMode, number[]>;
  completedPuzzles: Record<PuzzleMode, number[]>;

  constructor(rootStore: RootStore) {
    this.root = rootStore;
    this.initialized = false;
    this.playedPuzzles = emptyPuzzleHistory;
    this.completedPuzzles = emptyPuzzleHistory;

    makeObservable(this, {
      initialized: observable,
      playedPuzzles: observable,
      completedPuzzles: observable,
      initializeStore: action,
      score: computed,
      tutorialCompleted: computed,
      updateCompletedPuzzles: action,
      updatePlayedPuzzles: action,
    });
  }

  async initializeStore() {
    const playedPuzzles = await rehydrateObject("playedPuzzles");
    runInAction(() => {
      this.playedPuzzles = playedPuzzles || emptyPuzzleHistory;
    });
    const completedPuzzles = await rehydrateObject("completedPuzzles");
    runInAction(() => {
      this.completedPuzzles = completedPuzzles || emptyPuzzleHistory;
    });
    runInAction(() => {
      this.initialized = true;
    });
  }

  get score() {
    const _score = (Object.keys(this.completedPuzzles) as PuzzleMode[])
      .map((mode) => {
        return this.completedPuzzles[mode]
          .map((index) => {
            const puzzleScore = puzzles[mode]?.[index]?.score || 0;
            return puzzleScore;
          })
          .reduce(sum, 0);
      })
      .reduce(sum, 0);

    return _score;
  }

  get tutorialCompleted() {
    return this.completedPuzzles["tutorial"].length > 0;
  }

  updateCompletedPuzzles(mode?: PuzzleMode, index?: number) {
    if (mode && index !== undefined) {
      this.completedPuzzles[mode] = uniq(
        this.completedPuzzles[mode] || []
      ).filter((x) => x !== index);
      this.completedPuzzles[mode].push(index);
      persistObject("completedPuzzles", toJS(this.completedPuzzles));
    }
  }

  updatePlayedPuzzles(mode?: PuzzleMode, index?: number) {
    if (mode && index !== undefined) {
      this.playedPuzzles[mode] = uniq(this.playedPuzzles[mode] || []).filter(
        (x) => x !== index
      );
      this.playedPuzzles[mode].push(index);
      persistObject("playedPuzzles", toJS(this.playedPuzzles));
    }
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
