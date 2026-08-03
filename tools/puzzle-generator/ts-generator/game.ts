import { bitCount, trailingZeroCount } from "./bits";
import { Rng } from "./rng";
import { DeductionKind, PuzzleRows } from "./types";

interface Hint {
  at: number;
  size: number;
}

export interface IterationResult {
  kind: DeductionKind;
  count: number;
}

const emptyIteration = (): IterationResult => ({ kind: "none", count: 0 });

const createBoolArray = (length: number, value = false) =>
  Array.from({ length }, () => value);

export class GeneratorGame {
  readonly height: number;
  readonly width: number;
  readonly internalWidth: number;
  readonly pieceCount: number;

  hints: Hint[];
  validOrientation: number[];
  origPossible: number[];
  possible: number[];
  fixed: number[];
  forced: boolean[];
  border: boolean[];

  private cachedHintAt: number[];
  private cachedHintSize: number[];
  private pieceCellsCache: number[][];
  private pieceOrientationCellsCache: number[][][];
  private cellSetScratch: number[];
  private countScratch: number[];
  private emptyCellSet: number[];
  private markScratch: number[];

  private constructor(height: number, width: number, pieceCount: number) {
    this.height = height;
    this.width = width;
    this.internalWidth = width + 1;
    this.pieceCount = pieceCount;

    const total = this.totalCells;
    this.hints = Array.from({ length: pieceCount }, () => ({
      at: 0,
      size: 0,
    }));
    this.validOrientation = Array.from({ length: pieceCount }, () => 0);
    this.origPossible = Array.from({ length: total }, () => 0);
    this.possible = Array.from({ length: total }, () => 0);
    this.fixed = Array.from({ length: total }, () => 0);
    this.forced = createBoolArray(total);
    this.border = createBoolArray(total);
    this.cachedHintAt = Array.from({ length: pieceCount }, () => -1);
    this.cachedHintSize = Array.from({ length: pieceCount }, () => -1);
    this.pieceCellsCache = Array.from({ length: pieceCount }, () => []);
    this.pieceOrientationCellsCache = Array.from(
      { length: pieceCount },
      () => [],
    );
    this.cellSetScratch = Array.from({ length: total }, () => 0);
    this.countScratch = Array.from({ length: total }, () => 0);
    this.emptyCellSet = Array.from({ length: total }, () => 0);
    this.markScratch = Array.from({ length: total }, () => 0);

    for (let row = 0; row < height; row++) {
      this.border[this.index(row, -1)] = true;
    }
  }

  static random(params: {
    height: number;
    width: number;
    pieces: number;
    rng: Rng;
  }) {
    const game = new GeneratorGame(params.height, params.width, params.pieces);
    game.randomize(params.rng);
    game.prepareInitialPossibilities();
    return game;
  }

  static fromRows(rows: PuzzleRows) {
    if (!rows.length) {
      throw new Error("Cannot parse puzzle with no rows");
    }

    const width = rows[0].length;
    const pieceCount = rows
      .join("")
      .split("")
      .filter((value) => Number(value) > 0 && Number(value) <= 9).length;
    const game = new GeneratorGame(rows.length, width, pieceCount);
    let piece = 0;

    rows.forEach((rowString, row) => {
      if (rowString.length !== width) {
        throw new Error("All puzzle rows must have the same width");
      }
      rowString.split("").forEach((value, col) => {
        const at = game.index(row, col);
        if (value === ".") {
          game.forced[at] = true;
        } else if (Number(value) > 0 && Number(value) <= 9) {
          game.hints[piece] = { at, size: Number(value) };
          game.fixed[at] = game.pieceMask(piece);
          piece++;
        } else if (value !== " ") {
          throw new Error(`Invalid puzzle cell "${value}"`);
        }
      });
    });

    game.prepareInitialPossibilities();
    return game;
  }

  get totalCells() {
    return this.height * this.internalWidth;
  }

  clone() {
    const copy = new GeneratorGame(this.height, this.width, this.pieceCount);
    copy.hints = this.hints.map((hint) => ({ ...hint }));
    copy.validOrientation = this.validOrientation.slice();
    copy.origPossible = this.origPossible.slice();
    copy.possible = this.possible.slice();
    copy.fixed = this.fixed.slice();
    copy.forced = this.forced.slice();
    copy.border = this.border.slice();
    copy.cachedHintAt = this.cachedHintAt.slice();
    copy.cachedHintSize = this.cachedHintSize.slice();
    copy.pieceCellsCache = this.pieceCellsCache.slice();
    copy.pieceOrientationCellsCache = this.pieceOrientationCellsCache.map(
      (cellsByOrientation) => cellsByOrientation.slice(),
    );
    return copy;
  }

  toRows(): PuzzleRows {
    const hintByCell = Array.from({ length: this.totalCells }, () => 0);
    this.hints.forEach((hint) => {
      hintByCell[hint.at] = hint.size;
    });

    const rows: string[] = [];
    for (let row = 0; row < this.height; row++) {
      let rowString = "";
      for (let col = 0; col < this.width; col++) {
        const at = this.index(row, col);
        const hint = hintByCell[at];
        if (hint) {
          rowString += String(hint);
        } else if (this.forced[at]) {
          rowString += ".";
        } else {
          rowString += " ";
        }
      }
      rows.push(rowString);
    }
    return rows;
  }

  index(row: number, col: number) {
    return row * this.internalWidth + col + 1;
  }

  pieceMask(piece: number) {
    return 1 << piece;
  }

  maskToPiece(mask: number) {
    return trailingZeroCount(mask);
  }

  orientationCount(piece: number) {
    return bitCount(this.validOrientation[piece]);
  }

  resetPossible() {
    this.possible.fill(0);
  }

  resetForced() {
    this.forced.fill(false);
  }

  prepareInitialPossibilities() {
    this.resetHints();
    this.resetPossible();
    this.updatePossible();
    this.origPossible = this.possible.slice();
  }

  resetHints() {
    this.fixed.fill(0);
    for (let piece = 0; piece < this.pieceCount; piece++) {
      this.fixed[this.hints[piece].at] = this.pieceMask(piece);
    }
    for (let piece = 0; piece < this.pieceCount; piece++) {
      this.validOrientation[piece] = this.initValidOrientations(piece);
    }
  }

  iterate(): IterationResult {
    this.resetPossible();
    this.updatePossible();

    let count = this.updateUncontestedNoCover();
    if (count) return { kind: "uncontested_no_cover", count };

    count = this.updateForcedCoverage();
    if (count) return { kind: "cover", count };

    count = this.updateKnowledgeOfSingleSolution();
    if (count) {
      this.updateForcedCoverage();
      return { kind: "single_solution", count };
    }

    count = this.updateCantFit();
    if (count) return { kind: "cant_fit", count };

    this.updateSquare();
    count = this.updateCantFit();
    if (count) return { kind: "square", count };

    this.updateDependent();
    count = this.updateCantFit();
    if (count) return { kind: "dependency", count };

    this.updateOneOf();
    count = this.updateCantFit();
    if (count) return { kind: "one_of", count };

    return emptyIteration();
  }

  forceOneSquare(rng: Rng, possibleMask = (1 << this.pieceCount) - 1) {
    let bestAt = -1;
    let bestScore = -1;
    let bestScoreCount = 0;

    for (let at = 0; at < this.totalCells; at++) {
      if (
        this.fixed[at] ||
        this.forced[at] ||
        !(this.possible[at] & possibleMask)
      ) {
        continue;
      }

      const score = this.origPossibleCount(at) + this.possibleCount(at);
      if (score > bestScore) {
        bestScore = score;
        bestAt = at;
        bestScoreCount = 1;
      } else if (score === bestScore) {
        bestScoreCount++;
        if (rng.int(bestScoreCount) === 0) {
          bestAt = at;
        }
      }
    }

    if (bestAt >= 0) {
      this.forced[bestAt] = true;
      return true;
    }
    return false;
  }

  forceIfUncontested(rng: Rng) {
    this.resetPossible();
    this.updatePossible();
    let changed = false;
    for (let piece = 0; piece < this.pieceCount; piece++) {
      if (!this.findUncontestedNoCover(piece)) continue;
      if (!this.forceOneSquare(rng, this.pieceMask(piece))) {
        throw new Error("Expected uncontested piece to force a square");
      }
      changed = true;
    }
    return changed;
  }

  impossible() {
    for (let piece = 0; piece < this.pieceCount; piece++) {
      if (!this.validOrientation[piece]) return true;
    }
    for (let at = 0; at < this.totalCells; at++) {
      if (this.forced[at] && !this.possible[at]) return true;
    }
    return false;
  }

  solved() {
    for (let piece = 0; piece < this.pieceCount; piece++) {
      if (this.orientationCount(piece) !== 1) return false;
    }
    for (let at = 0; at < this.totalCells; at++) {
      if (this.forced[at] && !this.fixed[at]) return false;
    }
    try {
      this.validate();
      return true;
    } catch {
      return false;
    }
  }

  mutate(rng: Rng) {
    do {
      const piece = rng.int(this.pieceCount);
      const hint = this.hints[piece];

      switch (rng.int(3)) {
        case 0:
          if (hint.size > 1) hint.size--;
          break;
        case 1:
          if (hint.size < 8) hint.size++;
          break;
        case 2:
          this.fixed[hint.at] = 0;
          while (true) {
            const at = rng.int(this.totalCells);
            if (!this.fixed[at] && !this.border[at]) {
              hint.at = at;
              this.fixed[at] = this.pieceMask(piece);
              break;
            }
          }
          break;
      }
    } while (rng.int(3) < 1);

    this.prepareInitialPossibilities();
  }

  private randomize(rng: Rng) {
    for (let piece = 0; piece < this.pieceCount; piece++) {
      while (true) {
        const at = rng.int(this.totalCells);
        const size = 2 + rng.int(4);
        if (!this.fixed[at] && !this.border[at]) {
          this.hints[piece] = { at, size };
          this.fixed[at] = this.pieceMask(piece);
          break;
        }
      }
    }
  }

  private validate() {
    const counts = Array.from({ length: this.pieceCount }, () => 0);
    for (let piece = 0; piece < this.pieceCount; piece++) {
      if (this.orientationCount(piece) !== 1) {
        throw new Error("Cannot validate puzzle with unresolved orientation");
      }
      const orientation = trailingZeroCount(this.validOrientation[piece]);
      for (const at of this.pieceOrientationCellsForPiece(piece, orientation)) {
        if (this.fixed[at] && this.fixed[at] !== this.pieceMask(piece)) {
          throw new Error("Solved puzzle has intersecting pieces");
        }
        this.fixed[at] = this.pieceMask(piece);
      }
    }

    for (let at = 0; at < this.totalCells; at++) {
      if (this.forced[at] && !this.fixed[at]) {
        throw new Error("Solved puzzle has uncovered forced square");
      }
      if (this.fixed[at]) {
        counts[this.maskToPiece(this.fixed[at])]++;
      }
    }

    for (let piece = 0; piece < this.pieceCount; piece++) {
      if (counts[piece] !== this.hints[piece].size) {
        throw new Error("Solved puzzle has incorrect piece size");
      }
    }
  }

  private origPossibleCount(at: number) {
    return bitCount(this.origPossible[at]);
  }

  private possibleCount(at: number) {
    return bitCount(this.possible[at]);
  }

  private updatePossible() {
    for (let piece = 0; piece < this.pieceCount; piece++) {
      this.updatePossibleForPiece(piece);
    }
  }

  private updatePossibleForPiece(piece: number) {
    const mask = this.pieceMask(piece);
    const size = this.hints[piece].size;
    const valid = this.validOrientation[piece];

    for (let orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1 << orientation))) continue;

      let count = 0;
      const cells = this.pieceOrientationCellsForPiece(piece, orientation);
      for (const at of cells) {
        if (!this.fixed[at] || this.fixed[at] === mask) count++;
      }

      if (count === size) {
        for (const at of cells) {
          this.possible[at] |= mask;
        }
      } else {
        this.validOrientation[piece] &= ~(1 << orientation);
      }
    }
  }

  private updateForcedCoverage() {
    let count = 0;
    for (let piece = 0; piece < this.pieceCount; piece++) {
      count += this.updateForcedCoverageForPiece(piece);
    }
    return count;
  }

  private updateForcedCoverageForPiece(piece: number) {
    const mask = this.pieceMask(piece);
    let updated = 0;
    for (const at of this.pieceCellsForPiece(piece)) {
      if (!this.fixed[at] && this.forced[at] && this.possible[at] === mask) {
        updated = 1;
        this.fixed[at] = mask;
        this.updateNotPossible(at, piece);
      }
    }
    return updated;
  }

  private updateCantFit() {
    let count = 0;
    for (let piece = 0; piece < this.pieceCount; piece++) {
      count += this.updateCantFitForPiece(piece);
    }
    return count;
  }

  private updateCantFitForPiece(piece: number) {
    const mask = this.pieceMask(piece);
    const size = this.hints[piece].size;
    const valid = this.validOrientation[piece];
    const counts = this.countScratch;
    let validCount = 0;

    if (!valid) return 0;
    counts.fill(0);

    for (let orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1 << orientation))) continue;

      let ok = true;
      const cells = this.pieceOrientationCellsForPiece(piece, orientation);
      for (const at of cells) {
        if (!(this.possible[at] & mask)) ok = false;
      }
      if (ok) {
        validCount++;
        for (const at of cells) {
          counts[at]++;
        }
      }
    }

    let updated = 0;
    for (const at of this.pieceCellsForPiece(piece)) {
      if (!this.fixed[at] && counts[at] === validCount) {
        updated = 1;
        this.fixed[at] = mask;
        this.updateNotPossible(at, piece);
      }
    }
    return updated;
  }

  private updateNotPossible(updateAt: number, piece: number) {
    const size = this.hints[piece].size;
    const valid = this.validOrientation[piece];
    for (let orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1 << orientation))) continue;

      let intersects = false;
      for (const at of this.pieceOrientationCellsForPiece(piece, orientation)) {
        if (at === updateAt) intersects = true;
      }
      if (!intersects) {
        this.validOrientation[piece] &= ~(1 << orientation);
      }
    }
  }

  private initValidOrientations(piece: number) {
    const size = this.hints[piece].size;
    let valid = 0;
    for (let orientation = 0; orientation < size * 2; orientation++) {
      let count = 0;
      for (const at of this.pieceOrientationCellsForPiece(piece, orientation)) {
        if (
          !this.border[at] &&
          (!this.fixed[at] || this.fixed[at] === this.pieceMask(piece))
        ) {
          count++;
        }
      }
      if (count === size) {
        valid |= 1 << orientation;
      }
    }
    return valid;
  }

  private updateUncontestedNoCover() {
    for (let piece = 0; piece < this.pieceCount; piece++) {
      const orientationMask = this.findUncontestedNoCover(piece);
      if (!orientationMask) continue;
      this.validOrientation[piece] = orientationMask;
      const orientation = trailingZeroCount(orientationMask);
      for (const at of this.pieceOrientationCellsForPiece(piece, orientation)) {
        if (!this.fixed[at]) {
          this.fixed[at] = this.pieceMask(piece);
          this.updateNotPossible(at, piece);
        }
      }
      return 1;
    }
    return 0;
  }

  private findUncontestedNoCover(piece: number) {
    const mask = this.pieceMask(piece);
    let haveContested = false;

    for (const at of this.pieceCellsForPiece(piece)) {
      if (!this.fixed[at] && this.forced[at] && this.possible[at] & mask) {
        return 0;
      }
      if (this.possible[at] & mask && this.possible[at] !== mask) {
        haveContested = true;
      }
    }

    if (!haveContested) return 0;

    const size = this.hints[piece].size;
    const valid = this.validOrientation[piece];
    for (let orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1 << orientation))) continue;

      let ok = true;
      let nonFixed = false;
      for (const at of this.pieceOrientationCellsForPiece(piece, orientation)) {
        if (this.fixed[at]) {
          if (this.fixed[at] !== mask) ok = false;
        } else {
          nonFixed = true;
          if (this.possible[at] !== mask) ok = false;
        }
      }
      if (ok && nonFixed) return 1 << orientation;
    }

    return 0;
  }

  private updateKnowledgeOfSingleSolution() {
    let count = 0;
    for (let piece = 0; piece < this.pieceCount; piece++) {
      count += this.findKnowledgeOfSingleSolution(piece);
    }
    return count;
  }

  private findKnowledgeOfSingleSolution(piece: number) {
    const haveInformationUnion = this.cellSetScratch;
    let haveInformationCount = 0;
    let noInformationCount = 0;
    haveInformationUnion.fill(0);

    const size = this.hints[piece].size;
    const valid = this.validOrientation[piece];
    for (let orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1 << orientation))) continue;

      const cells = this.pieceOrientationCellsForPiece(piece, orientation);
      let ok = true;
      let overlapsForced = false;
      let cantOverlapWithOtherPieces = true;
      for (const at of cells) {
        if (!this.fixed[at]) {
          if (this.forced[at]) overlapsForced = true;
          if (this.possibleCount(at) !== 1) cantOverlapWithOtherPieces = false;
        } else if (this.fixed[at] !== this.pieceMask(piece)) {
          ok = false;
        }
      }
      if (!ok) continue;

      if (overlapsForced) {
        if (haveInformationCount) {
          const covered = this.markScratch;
          covered.fill(0);
          for (const at of cells) covered[at] = 1;
          for (let at = 0; at < this.totalCells; at++) {
            haveInformationUnion[at] =
              haveInformationUnion[at] && covered[at] ? 1 : 0;
          }
        } else {
          for (const at of cells) haveInformationUnion[at] = 1;
        }
        haveInformationCount++;
      } else if (cantOverlapWithOtherPieces) {
        noInformationCount++;
      }
    }

    if (noInformationCount > 1) {
      let updateCount = 0;
      for (const at of this.pieceCellsForPiece(piece)) {
        if (this.fixed[at]) continue;
        if (haveInformationUnion[at]) {
          this.fixed[at] = this.pieceMask(piece);
          this.updateNotPossible(at, piece);
          updateCount++;
        }
      }
      return updateCount;
    }
    return 0;
  }

  private updateDependent() {
    for (let at = 0; at < this.totalCells; at++) {
      if (!this.forced[at] || this.fixed[at] || this.possibleCount(at) <= 1) {
        continue;
      }

      const dep = this.cellSetScratch;
      dep.fill(1);
      for (let piece = 0; piece < this.pieceCount; piece++) {
        if (!(this.pieceMask(piece) & this.possible[at])) continue;
        const pieceDep = this.findDependent(piece, at);
        for (let index = 0; index < this.totalCells; index++) {
          dep[index] = dep[index] && pieceDep[index] ? 1 : 0;
        }
      }

      let depCount = 0;
      for (let index = 0; index < this.totalCells; index++) {
        if (dep[index]) depCount++;
      }

      if (depCount > 1) {
        for (let target = 0; target < this.pieceCount; target++) {
          if (
            dep[target] &&
            target !== at &&
            this.possible[at] !== this.possible[target] &&
            this.forced[target]
          ) {
            const shared = this.possible[target] & this.possible[at];
            this.possible[target] = shared;
            this.possible[at] = shared;
          }
        }
      }
    }
  }

  private findOneOf(piece: number, target: number) {
    return this.findDependent(piece, target, false);
  }

  private findDependent(piece: number, target: number, wantedOverlap = true) {
    const mask = this.pieceMask(piece);
    const size = this.hints[piece].size;
    const valid = this.validOrientation[piece];
    let ret: number[] | undefined;

    for (let orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1 << orientation))) continue;

      const cells = this.pieceOrientationCellsForPiece(piece, orientation);
      let overlapsTarget = false;
      let ok = true;
      for (const at of cells) {
        if (at === target) overlapsTarget = true;
        if (this.fixed[at] && this.fixed[at] !== mask) ok = false;
      }
      if (overlapsTarget === wantedOverlap && ok) {
        if (ret) {
          const covered = this.markScratch;
          covered.fill(0);
          for (const at of cells) covered[at] = 1;
          for (let at = 0; at < this.totalCells; at++) {
            ret[at] = ret[at] && covered[at] ? 1 : 0;
          }
        } else {
          ret = Array.from({ length: this.totalCells }, () => 0);
          for (const at of cells) {
            ret[at] = 1;
          }
        }
      }
    }

    return ret ?? this.emptyCellSet;
  }

  private updateSquare() {
    for (let piece = 0; piece < this.pieceCount; piece++) {
      const size = this.hints[piece].size;
      const covered: number[] = [];

      for (const at of this.pieceCellsForPiece(piece)) {
        if (
          this.forced[at] &&
          !this.fixed[at] &&
          this.possibleCount(at) === 2 &&
          this.possible[at] & this.pieceMask(piece)
        ) {
          covered.push(at);
        }
      }

      for (let i = 0; i < covered.length; i++) {
        for (let j = i + 1; j < covered.length; j++) {
          const ai = covered[i];
          const aj = covered[j];
          if (this.distance(ai, aj) <= size) continue;
          if (this.possible[ai] !== this.possible[aj]) continue;

          const valid = this.validOrientation[piece];
          for (let orientation = 0; orientation < size * 2; orientation++) {
            if (!(valid & (1 << orientation))) continue;

            let missesBoth = true;
            for (const at of this.pieceOrientationCellsForPiece(
              piece,
              orientation,
            )) {
              if (at === ai || at === aj) missesBoth = false;
            }
            if (missesBoth) {
              this.validOrientation[piece] &= ~(1 << orientation);
            }
          }
        }
      }
    }
  }

  private updateOneOf() {
    for (let at = 0; at < this.totalCells; at++) {
      if (this.fixed[at] || this.possibleCount(at) < 2) continue;

      const pair = this.findPiecesOnSameRowOrColumn(at);
      if (!pair) continue;

      const [pieceA, pieceB] = pair;
      const a = this.findOneOf(pieceA, at);
      const b = this.findOneOf(pieceB, at);
      let targetPiecesA = 0;
      let targetPiecesB = 0;

      for (let target = 0; target < this.totalCells; target++) {
        if (!a[target] && !b[target]) continue;
        for (let piece = 0; piece < this.pieceCount; piece++) {
          if (piece === pieceA || piece === pieceB) continue;
          if (this.pieceMask(piece) & this.possible[target]) {
            if (a[target]) targetPiecesA |= this.pieceMask(piece);
            if (b[target]) targetPiecesB |= this.pieceMask(piece);
          }
        }
      }

      const targetPiecesBoth = targetPiecesA & targetPiecesB;
      if (targetPiecesBoth) {
        for (let piece = 0; piece < this.pieceCount; piece++) {
          if (this.pieceMask(piece) & targetPiecesBoth) {
            this.excludeIfInBothSets(piece, a, b);
          }
        }
      }
    }
  }

  private findPiecesOnSameRowOrColumn(
    at: number,
  ): [number, number] | undefined {
    const possible = this.possible[at];
    for (let i = 0; i < this.pieceCount; i++) {
      if (!(possible & this.pieceMask(i))) continue;
      for (let j = i + 1; j < this.pieceCount; j++) {
        if (!(possible & this.pieceMask(j))) continue;
        const aAt = this.hints[i].at;
        const bAt = this.hints[j].at;
        if (
          Math.floor(aAt / this.internalWidth) ===
            Math.floor(bAt / this.internalWidth) ||
          aAt % this.internalWidth === bAt % this.internalWidth
        ) {
          return [i, j];
        }
      }
    }
    return undefined;
  }

  private excludeIfInBothSets(piece: number, a: number[], b: number[]) {
    const mask = this.pieceMask(piece);
    const size = this.hints[piece].size;
    const valid = this.validOrientation[piece];

    for (let orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1 << orientation))) continue;

      let aHit = false;
      let bHit = false;
      let ok = true;
      for (const at of this.pieceOrientationCellsForPiece(piece, orientation)) {
        if (a[at]) aHit = true;
        if (b[at]) bHit = true;
        if (this.fixed[at] && this.fixed[at] !== mask) ok = false;
      }
      if (ok && aHit && bHit) {
        this.validOrientation[piece] &= ~(1 << orientation);
      }
    }
  }

  private distance(a: number, b: number) {
    const rowA = Math.floor(a / this.internalWidth);
    const rowB = Math.floor(b / this.internalWidth);
    const colA = a % this.internalWidth;
    const colB = b % this.internalWidth;
    const rowDistance = Math.abs(rowA - rowB);
    const colDistance = Math.abs(colA - colB);
    if (rowDistance && colDistance) return this.internalWidth + this.height + 1;
    return rowDistance + colDistance;
  }

  private pieceOrientationCellsForPiece(piece: number, orientation: number) {
    this.ensurePieceCellCache(piece);
    return this.pieceOrientationCellsCache[piece][orientation] ?? [];
  }

  private pieceCellsForPiece(piece: number) {
    this.ensurePieceCellCache(piece);
    return this.pieceCellsCache[piece];
  }

  private ensurePieceCellCache(piece: number) {
    const hint = this.hints[piece];
    if (
      this.cachedHintAt[piece] === hint.at &&
      this.cachedHintSize[piece] === hint.size
    ) {
      return;
    }

    this.cachedHintAt[piece] = hint.at;
    this.cachedHintSize[piece] = hint.size;
    this.pieceCellsCache[piece] = this.computePieceCells(hint);
    this.pieceOrientationCellsCache[piece] = Array.from(
      { length: hint.size * 2 },
      (_, orientation) => this.computePieceOrientationCells(hint, orientation),
    );
  }

  private computePieceOrientationCells(hint: Hint, orientation: number) {
    const size = hint.size;
    const offset = size - 1 - (orientation >> 1);
    const step = orientation & 1 ? this.internalWidth : 1;
    const start = hint.at - offset * step;
    const end = start + size * step;

    if (start < 0 || end >= this.totalCells + step) {
      return [];
    }

    const cells: number[] = [];
    for (let at = start; at !== end; at += step) {
      cells.push(at);
    }
    return cells;
  }

  private computePieceCells(hint: Hint) {
    const cells = [hint.at];
    const row = Math.floor(hint.at / this.internalWidth);
    const col = hint.at % this.internalWidth;
    const size = hint.size;

    for (
      let candidateRow = Math.max(0, row - (size - 1));
      candidateRow < Math.min(this.height, row + size);
      candidateRow++
    ) {
      const at = candidateRow * this.internalWidth + col;
      if (at !== hint.at) cells.push(at);
    }

    for (
      let candidateCol = Math.max(0, col - (size - 1));
      candidateCol < Math.min(this.internalWidth, col + size);
      candidateCol++
    ) {
      const at = candidateCol + row * this.internalWidth;
      if (at !== hint.at) cells.push(at);
    }

    return cells;
  }
}
