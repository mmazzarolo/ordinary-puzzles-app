import { takeWhile, takeRightWhile, sortBy, intersectionBy } from "lodash";
import { observable, action, computed, autorun, makeObservable } from "mobx";
import { createContext, useContext } from "react";
import { LayoutRectangle, LayoutChangeEvent } from "react-native";

const isOppositeDirectionOf = (dir1: string, dir2: string) => {
  return (
    (dir1 === "right" && dir2 === "left") ||
    (dir1 === "left" && dir2 === "right") ||
    (dir1 === "top" && dir2 === "bottom") ||
    (dir1 === "bottom" && dir2 === "top")
  );
};

const sortInt = (a: number, b: number) => a - b;

export class Cell {
  root: RootStore;

  row: number;
  col: number;
  value: string;

  line?: Line = undefined;

  constructor(root: RootStore, row: number, col: number, value: string) {
    this.root = root;
    this.row = row;
    this.col = col;
    this.value = value;

    makeObservable(this, {
      line: observable,
      id: computed,
      completed: computed,
      valid: computed,
      filled: computed,
      orientation: computed,
      hovered: computed,
      highlighted: computed,
      setLine: action,
    });
  }

  get id() {
    return `${this.row}:${this.col}`;
  }

  get completed() {
    if (!this.line) return false;
    return this.line.completed;
  }

  get valid() {
    if (!this.line) return false;
    return this.line.valid;
  }

  get filled() {
    return !!this.line;
  }

  get orientation() {
    if (!this.line) return "none";
    if (this.line.orientation === "initial") {
      return this.line.origin.equals(this) ? "single" : "none";
    } else if (this.line.orientation === "horizontal") {
      const edgeCols = [this.line.edges[0].col, this.line.edges[1].col].sort(sortInt);
      const [leftEdgeCol, rightEdgeCol] = edgeCols;
      if (leftEdgeCol === this.col) {
        return "horizontal-left";
      } else if (rightEdgeCol === this.col) {
        return "horizontal-right";
      } else {
        return "horizontal-middle";
      }
    } else if (this.line.orientation === "vertical") {
      const edgeRows = [this.line.edges[0].row, this.line.edges[1].row].sort(sortInt);
      const [topEdgeRow, bottomEdgeRow] = edgeRows;
      if (topEdgeRow === this.row) {
        return "vertical-top";
      } else if (bottomEdgeRow === this.row) {
        return "vertical-bottom";
      } else {
        return "vertical-middle";
      }
    }
    return undefined;
  }

  get hovered() {
    return this.equals(this.root.interactions.hoveredCell);
  }

  get highlighted() {
    return this.hovered && this.line?.equals(this.root.interactions.draggedLine);
  }

  equals(cell?: Cell | null) {
    return cell ? this.id === cell.id : false;
  }

  onSameRowOf(cell: Cell) {
    return this.row === cell.row;
  }

  onSameColumnOf(cell: Cell) {
    return this.col === cell.col;
  }

  onLeftOf(cell: Cell) {
    return this.onSameRowOf(cell) && this.col <= cell.col;
  }

  onRightOf(cell: Cell) {
    return this.onSameRowOf(cell) && this.col >= cell.col;
  }

  onTopOf(cell: Cell) {
    return this.onSameColumnOf(cell) && this.row <= cell.row;
  }

  onBottomOf(cell: Cell) {
    return this.onSameColumnOf(cell) && this.row >= cell.row;
  }

  horizontallyAdjacentTo(cell: Cell) {
    return this.col + 1 === cell.col || this.col - 1 === cell.col;
  }

  verticallyAdjacentTo(cell: Cell) {
    return this.row + 1 === cell.row || this.row - 1 === cell.row;
  }

  setLine(line?: Line) {
    this.line = line;
  }
}

class Line {
  origin: Cell;
  committedCells = observable.array<Cell>([]);
  pendingCells = observable.array<Cell>([]);
  stale: boolean;
  currentHandler: Cell | null;

  constructor(origin: Cell) {
    this.origin = origin;
    this.committedCells.replace([origin]);
    this.pendingCells.replace([]);
    this.stale = false;
    this.currentHandler = null;

    makeObservable(this, {
      origin: observable,
      committedCells: observable,
      pendingCells: observable,
      stale: observable,
      currentHandler: observable,
      id: computed,
      orientation: computed,
      edges: computed,
      valid: computed,
      completed: computed,
      leftCommittedCells: computed,
      rightCommittedCells: computed,
      topCommittedCells: computed,
      bottomCommittedCells: computed,
      pendingCellsDirection: computed,
      draggedDirection: computed,
      cells: computed,
      unlinkReference: action,
      linkReference: action,
      stalify: action,
      replacePendingCells: action,
      commit: action,
      reset: action,
    });
  }

  get id() {
    return this.origin.id;
  }

  get orientation() {
    if (!this.cells.length) {
      throw new Error("Line.orientation » Lines with no cells set");
    } else if (this.cells.length === 1) {
      return "initial";
    } else if (this.cells[0].onSameRowOf(this.cells[1])) {
      return "horizontal";
    } else {
      return "vertical";
    }
  }

  get edges() {
    if (this.orientation === "initial") {
      return [this.cells[0], this.cells[0]];
    } else if (this.orientation === "horizontal") {
      const cellsByCols = sortBy(this.cells.slice(), (cell) => cell.col);
      return [cellsByCols[0], cellsByCols[cellsByCols.length - 1]];
    } else {
      const cellsByRows = sortBy(this.cells.slice(), (cell) => cell.row);
      return [cellsByRows[0], cellsByRows[cellsByRows.length - 1]];
    }
  }

  get valid() {
    return Number(this.origin.value) >= this.cells.length;
  }

  get completed() {
    return Number(this.origin.value) === this.cells.length;
  }

  get leftCommittedCells() {
    return this.committedCells.filter((cell) => cell.onLeftOf(this.origin));
  }

  get rightCommittedCells() {
    return this.committedCells.filter((cell) => cell.onRightOf(this.origin));
  }

  get topCommittedCells() {
    return this.committedCells.filter((cell) => cell.onTopOf(this.origin));
  }

  get bottomCommittedCells() {
    return this.committedCells.filter((cell) => cell.onBottomOf(this.origin));
  }

  get pendingCellsDirection() {
    if (this.pendingCells.length) {
      if (this.pendingCells[0].onSameRowOf(this.origin)) {
        return this.pendingCells[0].col > this.origin.col ? "right" : "left";
      }
      if (this.pendingCells[0].onSameColumnOf(this.origin)) {
        return this.pendingCells[0].row > this.origin.row ? "bottom" : "top";
      }
    }
    return "none";
  }

  get draggedDirection() {
    if (!this.currentHandler) return "none";
    if (this.currentHandler.equals(this.origin)) return "origin";
    if (this.currentHandler) {
      if (this.currentHandler.onSameRowOf(this.origin)) {
        return this.currentHandler.col > this.origin.col ? "right" : "left";
      }
      if (this.currentHandler.onSameColumnOf(this.origin)) {
        return this.currentHandler.row > this.origin.row ? "bottom" : "top";
      }
    }
    return "none";
  }

  get cells() {
    if (this.origin.equals(this.currentHandler)) {
      if (
        !this.pendingCells.length ||
        intersectionBy(this.pendingCells, this.committedCells, "id").length
      ) {
        return this.committedCells;
      }
    }
    const isOpp = isOppositeDirectionOf(this.draggedDirection, this.pendingCellsDirection);
    if (isOpp) {
      if (this.draggedDirection === "left") {
        return this.rightCommittedCells;
      } else if (this.draggedDirection === "right") {
        return this.leftCommittedCells;
      } else if (this.draggedDirection === "top") {
        return this.bottomCommittedCells;
      } else if (this.draggedDirection === "bottom") {
        return this.topCommittedCells;
      }
    }
    if (this.pendingCellsDirection === "left") {
      return this.rightCommittedCells.concat(this.pendingCells);
    } else if (this.pendingCellsDirection === "right") {
      return this.leftCommittedCells.concat(this.pendingCells);
    } else if (this.pendingCellsDirection === "top") {
      return this.bottomCommittedCells.concat(this.pendingCells);
    } else if (this.pendingCellsDirection === "bottom") {
      return this.topCommittedCells.concat(this.pendingCells);
    }
    if (this.stale) {
      if (this.draggedDirection === "left") {
        return this.rightCommittedCells;
      } else if (this.draggedDirection === "right") {
        return this.leftCommittedCells;
      } else if (this.draggedDirection === "top") {
        return this.bottomCommittedCells;
      } else if (this.draggedDirection === "bottom") {
        return this.topCommittedCells;
      }
      return this.pendingCells.concat([this.origin]);
    }
    return this.committedCells;
  }

  unlinkReference() {
    this.cells.forEach((cell) => cell.setLine(undefined));
  }

  linkReference() {
    this.cells.forEach((cell) => cell.setLine(this));
  }

  stalify(currentHandler: Cell) {
    this.currentHandler = currentHandler;
  }

  replacePendingCells(cells: Cell[]) {
    this.unlinkReference();
    if (!this.stale) {
      this.stale = true;
    }
    this.pendingCells.replace(cells.filter((cell) => !cell.equals(this.origin)));
    this.linkReference();
  }

  commit() {
    this.committedCells.replace(this.cells.slice());
    this.pendingCells.clear();
    this.stale = false;
  }

  reset() {
    this.unlinkReference();
    this.committedCells.replace([this.origin]);
    this.pendingCells.clear();
    this.linkReference();
  }

  isEdge(cell: Cell) {
    return this.edges[0].equals(cell) || this.edges[1].equals(cell);
  }

  equals(line?: Line) {
    return line && this.id === line.id;
  }
}

class BoardStore {
  root: RootStore;

  puzzleId?: string = undefined;
  grid = observable<Cell[]>([]);
  lines = observable<Line>([]);

  constructor(rootStore: RootStore) {
    this.root = rootStore;

    makeObservable(this, {
      puzzleId: observable,
      grid: observable,
      lines: observable,
      initialize: action,
      reset: action,
      destroy: action,
      isInitialized: computed,
      rowsCount: computed,
      colsCount: computed,
      cleared: computed,
      fillLine: action,
    });
  }

  initialize(puzzleId: string, rows: string[]) {
    const grid: Cell[][] = [];
    const lines: Line[] = [];
    rows.forEach((rowString: string, row: number) => {
      grid.push([]);
      rowString.split("").forEach((value: string, col: number) => {
        const cell = new Cell(this.root, row, col, value);
        if (Number(value) > 0 && Number(value) <= 9) {
          const line = new Line(cell);
          lines.push(line);
          cell.setLine(line);
        }
        grid[row].push(cell);
      });
    });
    this.grid.replace(grid);
    this.lines.replace(lines);
    this.puzzleId = puzzleId;
  }

  reset() {
    this.lines.forEach((line) => {
      line.reset();
    });
  }

  destroy() {
    this.puzzleId = undefined;
    this.grid.replace([]);
    this.lines.replace([]);
  }

  get isInitialized() {
    return !!this.grid.length;
  }

  get rowsCount() {
    return this.grid.length;
  }

  get colsCount() {
    return this.grid?.[0]?.length;
  }

  get cleared() {
    if (this.lines.find((line) => !line.completed)) {
      return false;
    }
    const hasEmptyDot = this.grid.some((row) => {
      return row.some((cell) => {
        if (cell.value === ".") {
          return !cell.valid || !cell.completed;
        }
        return false;
      });
    });
    if (hasEmptyDot) {
      return false;
    }
    return true;
  }

  fillLine(line: Line, from: Cell, to: Cell) {
    let cellsInBetween: Cell[] = [];
    const shouldDrop = (cell: Cell) => {
      return !cell.line || line.equals(cell.line);
    };
    if (from.onSameRowOf(to)) {
      const row = from.row;
      const [colStart, colEnd] = [from, to].map((cell) => cell.col).sort(sortInt);
      for (let col = colStart; col <= colEnd; col++) {
        cellsInBetween.push(this.at(row, col));
      }
      cellsInBetween =
        from.col < to.col
          ? takeWhile(cellsInBetween, shouldDrop)
          : takeRightWhile(cellsInBetween, shouldDrop);
    } else if (from.onSameColumnOf(to)) {
      const col = from.col;
      const [rowStart, rowEnd] = [from, to].map((cell) => cell.row).sort(sortInt);
      for (let row = rowStart; row <= rowEnd; row++) {
        cellsInBetween.push(this.at(row, col));
      }
      cellsInBetween =
        from.row < to.row
          ? takeWhile(cellsInBetween, shouldDrop)
          : takeRightWhile(cellsInBetween, shouldDrop);
    }
    line.replacePendingCells(cellsInBetween);
  }

  cellsBetween(line: Line, from: Cell, to: Cell) {
    const shouldDrop = (cell: Cell) => {
      return !cell.line || line.equals(cell.line);
    };
    if (from.onSameRowOf(to)) {
      const row = from.row;
      const [colStart, colEnd] = [from, to].map((cell) => cell.col).sort(sortInt);
      const cellsInBetween = [];
      for (let col = colStart; col <= colEnd; col++) {
        cellsInBetween.push(this.at(row, col));
      }
      return from.col < to.col
        ? takeWhile(cellsInBetween, shouldDrop)
        : takeRightWhile(cellsInBetween, shouldDrop);
    } else if (from.onSameColumnOf(to)) {
      const col = from.col;
      const [rowStart, rowEnd] = [from, to].map((cell) => cell.row).sort(sortInt);
      const cellsInBetween = [];
      for (let row = rowStart; row <= rowEnd; row++) {
        cellsInBetween.push(this.at(row, col));
      }
      return from.row < to.row
        ? takeWhile(cellsInBetween, shouldDrop)
        : takeRightWhile(cellsInBetween, shouldDrop);
    }
    return [];
  }

  at(row: number, col: number) {
    return this.grid[row][col];
  }

  atId(id: string) {
    const [row, col] = id.split(":");
    return this.at(Number(row), Number(col));
  }
}

class InteractionsStore {
  root: RootStore;

  gridLayout?: LayoutRectangle = undefined;
  currentHandler?: Cell = undefined;
  draggedLine?: Line = undefined;
  hoveredCell?: Cell = undefined;
  numberOfMoves = 0;

  constructor(rootStore: RootStore) {
    makeObservable(this, {
      currentHandler: observable,
      draggedLine: observable,
      hoveredCell: observable,
      numberOfMoves: observable,
      enableInteraction: action,
      disableInteractions: action,
      isDragging: computed,
      onCellTouch: action,
      onCellEnter: action,
      onCellLeave: action,
      onCellTouchEnd: action,
      onGridTouchExit: action,
    });

    this.root = rootStore;
    autorun(() => {
      if (this.root.board.cleared) {
        this.disableInteractions();
      }
    });
  }

  enableInteraction(layoutChangeEvent: LayoutChangeEvent) {
    this.gridLayout = layoutChangeEvent.nativeEvent.layout;

    this.currentHandler = undefined;
    this.draggedLine = undefined;
    this.hoveredCell = undefined;
    this.numberOfMoves = 0;
  }

  disableInteractions() {
    this.gridLayout = undefined;
    this.currentHandler = undefined;
    this.draggedLine = undefined;
    this.hoveredCell = undefined;
    this.numberOfMoves = 0;
  }

  get isDragging() {
    return !!this.currentHandler;
  }

  /* ===================
   * REACT NATIVE EVENTS
   * =================== */
  findCell(coords: [number, number]) {
    const [x, y] = coords;
    if (!this.gridLayout) return;
    const cellWidth = this.gridLayout.width / this.root.board.colsCount;
    const cellHeight = this.gridLayout.height / this.root.board.rowsCount;
    const row = Math.floor(y / cellHeight);
    const col = Math.floor(x / cellWidth);
    const cell = this.root.board.at(row, col);
    return cell;
  }

  isOutsideGrid(coords: [number, number]) {
    const [x, y] = coords;
    if (!this.gridLayout) return true;
    return y <= 0 || y >= this.gridLayout.height || x <= 0 || x >= this.gridLayout.width;
  }

  onGridPointerDown(coords: [number, number]) {
    if (this.isOutsideGrid(coords)) {
      this.onGridTouchExit();
      return;
    }
    const cell = this.findCell(coords);
    if (!cell) return;
    this.onCellTouch(cell);
  }

  onGridPointerMove(coords: [number, number]) {
    if (!this.isDragging) return;
    if (this.isOutsideGrid(coords)) {
      this.onGridTouchExit();
      return;
    }
    const cell = this.findCell(coords);
    if (!cell) return;
    const isNewCell = !cell.equals(this.hoveredCell);
    if (isNewCell) {
      if (this.hoveredCell) {
        this.onCellLeave(this.hoveredCell);
      }
      this.onCellEnter(cell);
    }
  }

  onGridPointerUp(coords: [number, number]) {
    if (!this.isDragging) return;
    if (this.isOutsideGrid(coords)) {
      this.onGridTouchExit();
      return;
    }
    const cell = this.findCell(coords);
    if (!cell) return;
    this.onCellTouchEnd(cell);
  }

  /* ===================
   * COMMON HANDLERS
   * =================== */
  onCellTouch(cell: Cell) {
    const line = cell.line;
    if (!line) return;
    const isValidHandler = cell.equals(line.origin) || line.isEdge(cell);
    if (isValidHandler) {
      this.currentHandler = cell;
      this.draggedLine = line;
      this.hoveredCell = cell;
    }
    line.stalify(cell);
  }

  onCellEnter(cell: Cell) {
    if (!this.currentHandler || !this.draggedLine) return;
    this.numberOfMoves++;
    if (!this.draggedLine.origin.onSameColumnOf(cell) && !this.draggedLine.origin.onSameRowOf(cell))
      return;
    this.hoveredCell = cell;

    this.root.board.fillLine(this.draggedLine, this.draggedLine.origin, cell);
  }

  onCellLeave(cell: Cell) {
    if (!this.currentHandler || !this.draggedLine) return;
    if (
      cell.equals(this.currentHandler) &&
      cell.equals(this.draggedLine.origin) &&
      !this.draggedLine.isEdge(cell)
    ) {
      this.draggedLine.reset();
    }
  }

  onCellTouchEnd(cell: Cell) {
    if (!this.currentHandler || !this.draggedLine) return;
    const isOrigin = cell.equals(this.draggedLine.origin);
    const isTap = this.numberOfMoves < 1 && this.currentHandler.equals(this.draggedLine.origin);
    if (isOrigin && isTap) {
      this.draggedLine.reset();
    }
    if (this.draggedLine) {
      this.draggedLine.commit();
    }
    this.currentHandler = undefined;
    this.draggedLine = undefined;
    this.hoveredCell = undefined;
    this.numberOfMoves = 0;
  }

  onGridTouchExit() {
    if (this.draggedLine) {
      this.draggedLine.commit();
    }
    this.currentHandler = undefined;
    this.draggedLine = undefined;
    this.hoveredCell = undefined;
    this.numberOfMoves = 0;
  }
}

class RootStore {
  board: BoardStore;
  interactions: InteractionsStore;

  constructor() {
    this.board = new BoardStore(this);
    this.interactions = new InteractionsStore(this);
  }
}

export const rootStore = new RootStore();

export const storesContext = createContext({
  board: rootStore.board,
  interactions: rootStore.interactions,
});

export const useBoardStores = () => useContext(storesContext);
