import { RootStore } from "./store";

// Board notation: digits are line origins (the digit is the required line
// length), "." are dots that must be covered by a line, " " is empty.
const createStore = (rows: string[]) => {
  const store = new RootStore();
  store.board.initialize("test-puzzle", rows);
  return store;
};

// Simulates a full pointer gesture at the cell level: touch a handler cell,
// hover the target cell, release on it.
const drag = (
  store: RootStore,
  from: [number, number],
  to: [number, number],
) => {
  const fromCell = store.board.at(...from);
  const toCell = store.board.at(...to);
  store.interactions.onCellTouch(fromCell);
  store.interactions.onCellEnter(toCell);
  store.interactions.onCellTouchEnd(toCell);
};

const tap = (store: RootStore, at: [number, number]) => {
  const cell = store.board.at(...at);
  store.interactions.onCellTouch(cell);
  store.interactions.onCellTouchEnd(cell);
};

describe("board initialization", () => {
  it("builds the grid and one line per numeric cell", () => {
    const store = createStore(["3. ", " .2"]);
    expect(store.board.isInitialized).toBe(true);
    expect(store.board.rowsCount).toBe(2);
    expect(store.board.colsCount).toBe(3);
    expect(store.board.lines.length).toBe(2);
    expect(store.board.at(0, 0).filled).toBe(true);
    expect(store.board.at(0, 1).filled).toBe(false);
    expect(store.board.at(1, 2).filled).toBe(true);
  });

  it("resolves cells by coordinates and by id", () => {
    const store = createStore(["3. ", " .2"]);
    expect(store.board.at(1, 2).id).toBe("1:2");
    expect(store.board.atId("1:2")).toBe(store.board.at(1, 2));
  });

  it("starts every line as a single-cell initial line", () => {
    const store = createStore(["3. "]);
    const [line] = store.board.lines;
    expect(line.orientation).toBe("initial");
    expect(line.cells.length).toBe(1);
    expect(line.valid).toBe(true);
    expect(line.completed).toBe(false);
  });

  it("destroy clears the board", () => {
    const store = createStore(["3. "]);
    store.board.destroy();
    expect(store.board.isInitialized).toBe(false);
    expect(store.board.lines.length).toBe(0);
  });
});

describe("line dragging", () => {
  it("completes a horizontal line dragged to its exact length", () => {
    const store = createStore(["3.. "]);
    drag(store, [0, 0], [0, 2]);
    const [line] = store.board.lines;
    expect(line.cells.length).toBe(3);
    expect(line.orientation).toBe("horizontal");
    expect(line.completed).toBe(true);
    expect(line.valid).toBe(true);
  });

  it("completes a vertical line dragged to its exact length", () => {
    const store = createStore(["2 ", ". "]);
    drag(store, [0, 0], [1, 0]);
    const [line] = store.board.lines;
    expect(line.cells.length).toBe(2);
    expect(line.orientation).toBe("vertical");
    expect(line.completed).toBe(true);
  });

  it("marks a line longer than its number as invalid", () => {
    const store = createStore(["2... "]);
    drag(store, [0, 0], [0, 3]);
    const [line] = store.board.lines;
    expect(line.cells.length).toBe(4);
    expect(line.valid).toBe(false);
    expect(line.completed).toBe(false);
  });

  it("exposes edge and middle orientations for rendering", () => {
    const store = createStore(["3.. "]);
    drag(store, [0, 0], [0, 2]);
    expect(store.board.at(0, 0).orientation).toBe("horizontal-left");
    expect(store.board.at(0, 1).orientation).toBe("horizontal-middle");
    expect(store.board.at(0, 2).orientation).toBe("horizontal-right");
  });

  it("stops a drag at a cell already owned by another line", () => {
    const store = createStore(["3.2."]);
    drag(store, [0, 0], [0, 3]);
    const [lineA] = store.board.lines;
    // The "2" origin at col 2 blocks the fill: only col 0 and col 1 remain.
    expect(lineA.cells.map((cell) => cell.id)).toEqual(["0:0", "0:1"]);
    expect(store.board.at(0, 2).line).not.toBe(lineA);
  });

  it("ignores a drag that leaves the origin row and column", () => {
    const store = createStore(["3. ", " . "]);
    const origin = store.board.at(0, 0);
    const diagonal = store.board.at(1, 1);
    store.interactions.onCellTouch(origin);
    store.interactions.onCellEnter(diagonal);
    store.interactions.onCellTouchEnd(diagonal);
    const [line] = store.board.lines;
    expect(line.cells.length).toBe(1);
  });

  it("only starts a drag from an origin or an edge", () => {
    const store = createStore(["3.. "]);
    drag(store, [0, 0], [0, 2]);
    const middle = store.board.at(0, 1);
    store.interactions.onCellTouch(middle);
    expect(store.interactions.isDragging).toBe(false);
  });

  it("extends a committed line in the opposite direction", () => {
    const store = createStore([".3. "]);
    drag(store, [0, 1], [0, 0]);
    // The origin is now the right edge; extend from it to the right.
    drag(store, [0, 1], [0, 2]);
    const [line] = store.board.lines;
    expect(line.cells.map((cell) => cell.id).sort()).toEqual([
      "0:0",
      "0:1",
      "0:2",
    ]);
    expect(line.completed).toBe(true);
  });

  it("drops the previous segment when dragging across the origin", () => {
    const store = createStore(["..2.."]);
    drag(store, [0, 2], [0, 4]);
    // Grab the right edge and drag it to the left side of the origin.
    const rightEdge = store.board.at(0, 4);
    const leftTarget = store.board.at(0, 1);
    store.interactions.onCellTouch(rightEdge);
    store.interactions.onCellEnter(leftTarget);
    store.interactions.onCellTouchEnd(leftTarget);
    const [line] = store.board.lines;
    expect(line.cells.every((cell) => cell.col <= 2)).toBe(true);
  });

  it("resets a committed line when its origin is tapped", () => {
    const store = createStore(["3.. "]);
    drag(store, [0, 0], [0, 2]);
    tap(store, [0, 0]);
    const [line] = store.board.lines;
    expect(line.cells.length).toBe(1);
    expect(store.board.at(0, 1).filled).toBe(false);
    expect(store.board.at(0, 2).filled).toBe(false);
  });
});

describe("puzzle completion", () => {
  it("is not cleared while a line is incomplete", () => {
    const store = createStore(["2."]);
    expect(store.board.cleared).toBe(false);
  });

  it("is cleared when all lines are complete and all dots covered", () => {
    const store = createStore(["2."]);
    drag(store, [0, 0], [0, 1]);
    expect(store.board.cleared).toBe(true);
  });

  it("is not cleared when a dot stays uncovered", () => {
    const store = createStore(["2 ."]);
    drag(store, [0, 0], [0, 1]);
    const [line] = store.board.lines;
    expect(line.completed).toBe(true);
    expect(store.board.cleared).toBe(false);
  });

  it("is not cleared when a covering line is only valid, not complete", () => {
    const store = createStore(["3.."]);
    drag(store, [0, 0], [0, 1]);
    const [line] = store.board.lines;
    expect(line.valid).toBe(true);
    expect(store.board.cleared).toBe(false);
  });

  it("board reset returns every line to its origin", () => {
    const store = createStore(["2.", ". ", "2 "]);
    drag(store, [0, 0], [0, 1]);
    store.board.reset();
    store.board.lines.forEach((line) => {
      expect(line.cells.length).toBe(1);
    });
    expect(store.board.at(0, 1).filled).toBe(false);
  });

  it("disables interactions once the board is cleared", () => {
    const store = createStore(["2."]);
    const layoutChangeEvent = {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 100 } },
    };
    store.interactions.enableInteraction(layoutChangeEvent as never);
    drag(store, [0, 0], [0, 1]);
    expect(store.board.cleared).toBe(true);
    expect(store.interactions.gridLayout).toBeUndefined();
  });
});

describe("pointer coordinate mapping", () => {
  const layoutChangeEvent = {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 100 } },
  };

  it("maps grid coordinates to cells", () => {
    const store = createStore(["3.. "]);
    store.interactions.enableInteraction(layoutChangeEvent as never);
    // 4 columns over 300px -> 75px per cell.
    expect(store.interactions.findCell([10, 10])?.id).toBe("0:0");
    expect(store.interactions.findCell([160, 10])?.id).toBe("0:2");
  });

  it("detects coordinates outside of the grid", () => {
    const store = createStore(["3.. "]);
    store.interactions.enableInteraction(layoutChangeEvent as never);
    expect(store.interactions.isOutsideGrid([10, 10])).toBe(false);
    expect(store.interactions.isOutsideGrid([310, 10])).toBe(true);
    expect(store.interactions.isOutsideGrid([10, -1])).toBe(true);
  });

  it("completes a line through raw pointer events", () => {
    const store = createStore(["3.. "]);
    store.interactions.enableInteraction(layoutChangeEvent as never);
    store.interactions.onGridPointerDown([10, 50]);
    store.interactions.onGridPointerMove([100, 50]);
    store.interactions.onGridPointerMove([180, 50]);
    store.interactions.onGridPointerUp([180, 50]);
    const [line] = store.board.lines;
    expect(line.completed).toBe(true);
  });

  it("commits the dragged line when the pointer leaves the grid", () => {
    const store = createStore(["3.. "]);
    store.interactions.enableInteraction(layoutChangeEvent as never);
    store.interactions.onGridPointerDown([10, 50]);
    store.interactions.onGridPointerMove([100, 50]);
    store.interactions.onGridPointerMove([500, 50]);
    const [line] = store.board.lines;
    expect(store.interactions.isDragging).toBe(false);
    expect(line.cells.length).toBe(2);
  });
});
