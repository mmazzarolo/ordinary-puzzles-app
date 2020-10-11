import { createContext, useContext } from "react";
import { observable, action, computed, toJS, runInAction } from "mobx";
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

  @observable currentRoute: Route;
  @observable routesHistory = observable.array<Route>();

  constructor(rootStore: RootStore) {
    this.root = rootStore;
    this.currentRoute = "home";
    this.routesHistory.replace(["home"]);
  }

  @computed
  get hasLoadedHomeOnce() {
    return (
      this.routesHistory.length > 1 &&
      this.routesHistory.filter((x) => x === "home").length > 1
    );
  }

  @action
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

  @observable mode?: PuzzleMode;
  @observable index?: number;
  @observable increasesScore: boolean;

  constructor(rootStore: RootStore) {
    this.root = rootStore;
    this.increasesScore = false;
  }

  @computed
  get current() {
    if (this.mode && this.index !== undefined) {
      return puzzles[this.mode][this.index];
    } else {
      return undefined;
    }
  }

  @computed
  get name() {
    return this.current?.name || "";
  }

  @computed
  get prefix() {
    const modePrefix = {
      tutorial: "xs",
      small: "sm",
      medium: "md",
      large: "lg",
    };
    return this.mode ? modePrefix[this.mode] : "ko";
  }

  @computed
  get id() {
    return this.name;
  }

  @computed
  get data() {
    return this.current?.data;
  }

  @computed
  get type() {
    return this.current?.type || "puzzle";
  }

  @computed
  get score() {
    return this.current?.score || 0;
  }

  /* ===================
   * TUTORIAL
   * =================== */
  @computed
  get isTutorialEnd() {
    return (
      this.mode === "tutorial" && this.index === puzzles.tutorial.length - 1
    );
  }

  @computed
  get tutorialTitle() {
    return this.current?.title || "";
  }

  @computed
  get tutorialMessage() {
    return this.current?.message || "";
  }

  /* ===================
   * GENERIC ACTIONS
   * =================== */
  @action
  setPuzzle(mode: PuzzleMode = this.mode || "small", index: number) {
    this.mode = mode;
    this.index = index;
    this.root.stats.updatePlayedPuzzles(mode, index);
    this.increasesScore =
      this.root.stats.completedPuzzles[this.mode]?.indexOf(this.index) === -1;
  }

  @action
  setRandomPuzzle(mode: PuzzleMode = this.mode || "small") {
    const randomPuzzleIndex = pickRandomPuzzle({
      allPuzzlesLength: puzzles[mode].length,
      playedHistory: this.root.stats.playedPuzzles[mode],
      completedHistory: this.root.stats.completedPuzzles[mode],
    });
    this.setPuzzle(mode, randomPuzzleIndex);
  }

  @action
  nextPuzzle() {
    if (this.index !== undefined) this.index = this.index + 1;
  }

  @action
  onPuzzleCompleted() {
    this.root.stats.updateCompletedPuzzles(this.mode, this.index);
  }

  @action
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

  @observable initialized: boolean;
  @observable playedPuzzles: Record<PuzzleMode, number[]>;
  @observable completedPuzzles: Record<PuzzleMode, number[]>;

  constructor(rootStore: RootStore) {
    this.root = rootStore;
    this.initialized = false;
    this.playedPuzzles = emptyPuzzleHistory;
    this.completedPuzzles = emptyPuzzleHistory;
  }

  @action
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

  @computed
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

  @computed
  get tutorialCompleted() {
    return this.completedPuzzles["tutorial"].length > 0;
  }

  @action
  updateCompletedPuzzles(mode?: PuzzleMode, index?: number) {
    if (mode && index !== undefined) {
      this.completedPuzzles[mode] = uniq(
        this.completedPuzzles[mode] || []
      ).filter((x) => x !== index);
      this.completedPuzzles[mode].push(index);
      persistObject("completedPuzzles", toJS(this.completedPuzzles));
    }
  }

  @action
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
