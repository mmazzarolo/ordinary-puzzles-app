// Native offline puzzle generator used by tooling, not by the app runtime.
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cmath>
#include <cstring>
#include <iostream>
#include <numeric>
#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

struct Rng {
  uint32_t state;

  explicit Rng(uint32_t seed) : state(seed) {}

  uint32_t nextUint32() {
    uint32_t t = state += 0x6d2b79f5u;
    t = static_cast<uint32_t>((t ^ (t >> 15)) * (t | 1u));
    t ^= t + static_cast<uint32_t>((t ^ (t >> 7)) * (t | 61u));
    return t ^ (t >> 14);
  }

  int intValue(int maxExclusive) {
    if (maxExclusive <= 0) {
      throw std::runtime_error("Rng.int expected positive max");
    }
    return static_cast<int>(nextUint32() % static_cast<uint32_t>(maxExclusive));
  }
};

uint32_t hashSeed(const std::string &value) {
  uint32_t hash = 2166136261u;
  for (unsigned char c : value) {
    hash ^= c;
    hash = static_cast<uint32_t>(hash * 16777619u);
  }
  return hash;
}

int bitCount(uint32_t value) {
  return __builtin_popcount(value);
}

int trailingZeroCount(uint32_t value) {
  if (!value) {
    throw std::runtime_error("trailingZeroCount expected non-zero value");
  }
  return __builtin_ctz(value);
}

struct Hint {
  int at = 0;
  int size = 0;
};

enum class DeductionKind {
  None,
  Cover,
  CantFit,
  Square,
  Dependency,
  OneOf,
  SingleSolution,
  UncontestedNoCover,
};

struct IterationResult {
  DeductionKind kind = DeductionKind::None;
  int count = 0;
};

struct Meta {
  int depth = 0;
  int maxWidth = 0;
};

struct Classification {
  Meta all;
  Meta oneOf;
  Meta dep;
  Meta square;
  Meta cantFit;
  Meta cover;
  Meta singleSolution;
  Meta uncontestedNoCover;
  bool solved = false;
};

struct Profile {
  long long candidateAttempts = 0;
  long long classifications = 0;
  long long optimizationIterations = 0;
  long long rejectedCandidatesWithoutAdvancedDeduction = 0;
  long long rejectedUnacceptedPuzzles = 0;
  long long solvedCandidates = 0;
  long long topLevelAttempts = 0;
};

struct DifficultyVariant {
  int height = 0;
  int width = 0;
  int pieces = 0;
  int scoreCover = 0;
  int scoreCantFit = 0;
  int scoreSquare = 0;
  int scoreDep = 0;
  int scoreOneOf = 0;
  int scoreMaxWidth = 0;
  int scoreSingleSolution = -50;
  int scoreUncontestedNoCover = -1;
  int optimizeIterations = 100;
};

enum class Mode {
  Small,
  Medium,
  Large,
  Expert,
  Extraordinary,
};

struct DifficultySpec {
  Mode mode;
  std::string name;
  std::vector<DifficultyVariant> variants;
  bool requireAdvancedCandidate = false;
};

struct GeneratorGame {
  int height;
  int width;
  int internalWidth;
  int pieceCount;

  std::vector<Hint> hints;
  std::vector<uint32_t> validOrientation;
  std::vector<uint32_t> origPossible;
  std::vector<uint32_t> possible;
  std::vector<uint32_t> fixed;
  std::vector<uint8_t> forced;
  std::vector<uint8_t> border;

  std::vector<int> cachedHintAt;
  std::vector<int> cachedHintSize;
  std::vector<std::vector<int>> pieceCellsCache;
  std::vector<std::vector<std::vector<int>>> pieceOrientationCellsCache;
  std::vector<uint8_t> cellSetScratch;
  std::vector<int> countScratch;
  std::vector<uint8_t> markScratch;

  GeneratorGame(int gameHeight, int gameWidth, int pieces)
      : height(gameHeight), width(gameWidth), internalWidth(gameWidth + 1),
        pieceCount(pieces), hints(pieces), validOrientation(pieces),
        origPossible(totalCells()), possible(totalCells()), fixed(totalCells()),
        forced(totalCells()), border(totalCells()), cachedHintAt(pieces, -1),
        cachedHintSize(pieces, -1), pieceCellsCache(pieces),
        pieceOrientationCellsCache(pieces), cellSetScratch(totalCells()),
        countScratch(totalCells()), markScratch(totalCells()) {
    for (int row = 0; row < height; row++) {
      border[index(row, -1)] = true;
    }
  }

  static GeneratorGame random(int height, int width, int pieces, Rng &rng) {
    GeneratorGame game(height, width, pieces);
    game.randomize(rng);
    game.prepareInitialPossibilities();
    return game;
  }

  static GeneratorGame fromRows(const std::vector<std::string> &rows) {
    if (rows.empty()) {
      throw std::runtime_error("Cannot parse puzzle with no rows");
    }

    int width = static_cast<int>(rows[0].size());
    int pieces = 0;
    for (const auto &row : rows) {
      for (char value : row) {
        if (value >= '1' && value <= '9') {
          pieces++;
        }
      }
    }

    GeneratorGame game(static_cast<int>(rows.size()), width, pieces);
    int piece = 0;
    for (int row = 0; row < static_cast<int>(rows.size()); row++) {
      if (static_cast<int>(rows[row].size()) != width) {
        throw std::runtime_error("All puzzle rows must have the same width");
      }
      for (int col = 0; col < width; col++) {
        char value = rows[row][col];
        int at = game.index(row, col);
        if (value == '.') {
          game.forced[at] = true;
        } else if (value >= '1' && value <= '9') {
          game.hints[piece] = Hint{at, value - '0'};
          game.fixed[at] = game.pieceMask(piece);
          piece++;
        } else if (value != ' ') {
          throw std::runtime_error("Invalid puzzle cell");
        }
      }
    }

    game.prepareInitialPossibilities();
    return game;
  }

  std::vector<std::string> toRows() const {
    std::vector<int> hintByCell(totalCells(), 0);
    for (const auto &hint : hints) {
      hintByCell[hint.at] = hint.size;
    }

    std::vector<std::string> rows;
    rows.reserve(height);
    for (int row = 0; row < height; row++) {
      std::string rowString;
      rowString.reserve(width);
      for (int col = 0; col < width; col++) {
        int at = index(row, col);
        int hint = hintByCell[at];
        if (hint) {
          rowString.push_back(static_cast<char>('0' + hint));
        } else if (forced[at]) {
          rowString.push_back('.');
        } else {
          rowString.push_back(' ');
        }
      }
      rows.push_back(rowString);
    }
    return rows;
  }

  int totalCells() const {
    return height * internalWidth;
  }

  int index(int row, int col) const {
    return row * internalWidth + col + 1;
  }

  uint32_t pieceMask(int piece) const {
    return 1u << piece;
  }

  int maskToPiece(uint32_t mask) const {
    return trailingZeroCount(mask);
  }

  int orientationCount(int piece) const {
    return bitCount(validOrientation[piece]);
  }

  void resetPossible() {
    std::fill(possible.begin(), possible.end(), 0);
  }

  void resetForced() {
    std::fill(forced.begin(), forced.end(), 0);
  }

  void prepareInitialPossibilities() {
    resetHints();
    resetPossible();
    updatePossible();
    origPossible = possible;
  }

  void resetHints() {
    std::fill(fixed.begin(), fixed.end(), 0);
    for (int piece = 0; piece < pieceCount; piece++) {
      fixed[hints[piece].at] = pieceMask(piece);
    }
    for (int piece = 0; piece < pieceCount; piece++) {
      validOrientation[piece] = initValidOrientations(piece);
    }
  }

  IterationResult iterate() {
    resetPossible();
    updatePossible();

    int count = updateUncontestedNoCover();
    if (count) return {DeductionKind::UncontestedNoCover, count};

    count = updateForcedCoverage();
    if (count) return {DeductionKind::Cover, count};

    count = updateKnowledgeOfSingleSolution();
    if (count) {
      updateForcedCoverage();
      return {DeductionKind::SingleSolution, count};
    }

    count = updateCantFit();
    if (count) return {DeductionKind::CantFit, count};

    updateSquare();
    count = updateCantFit();
    if (count) return {DeductionKind::Square, count};

    updateDependent();
    count = updateCantFit();
    if (count) return {DeductionKind::Dependency, count};

    updateOneOf();
    count = updateCantFit();
    if (count) return {DeductionKind::OneOf, count};

    return {};
  }

  bool forceOneSquare(Rng &rng, uint32_t possibleMask) {
    int bestAt = -1;
    int bestScore = -1;
    int bestScoreCount = 0;

    for (int at = 0; at < totalCells(); at++) {
      if (fixed[at] || forced[at] || !(possible[at] & possibleMask)) {
        continue;
      }

      int score = origPossibleCount(at) + possibleCount(at);
      if (score > bestScore) {
        bestScore = score;
        bestAt = at;
        bestScoreCount = 1;
      } else if (score == bestScore) {
        bestScoreCount++;
        if (rng.intValue(bestScoreCount) == 0) {
          bestAt = at;
        }
      }
    }

    if (bestAt >= 0) {
      forced[bestAt] = true;
      return true;
    }
    return false;
  }

  bool forceOneSquare(Rng &rng) {
    return forceOneSquare(rng, (1u << pieceCount) - 1u);
  }

  bool forceIfUncontested(Rng &rng) {
    resetPossible();
    updatePossible();
    bool changed = false;
    for (int piece = 0; piece < pieceCount; piece++) {
      if (!findUncontestedNoCover(piece)) continue;
      if (!forceOneSquare(rng, pieceMask(piece))) {
        throw std::runtime_error("Expected uncontested piece to force a square");
      }
      changed = true;
    }
    return changed;
  }

  bool impossible() const {
    for (int piece = 0; piece < pieceCount; piece++) {
      if (!validOrientation[piece]) return true;
    }
    for (int at = 0; at < totalCells(); at++) {
      if (forced[at] && !possible[at]) return true;
    }
    return false;
  }

  bool solved() {
    for (int piece = 0; piece < pieceCount; piece++) {
      if (orientationCount(piece) != 1) return false;
    }
    for (int at = 0; at < totalCells(); at++) {
      if (forced[at] && !fixed[at]) return false;
    }
    try {
      validate();
      return true;
    } catch (...) {
      return false;
    }
  }

  void mutate(Rng &rng) {
    do {
      int piece = rng.intValue(pieceCount);
      Hint &hint = hints[piece];

      switch (rng.intValue(3)) {
        case 0:
          if (hint.size > 1) hint.size--;
          break;
        case 1:
          if (hint.size < 8) hint.size++;
          break;
        case 2:
          fixed[hint.at] = 0;
          while (true) {
            int at = rng.intValue(totalCells());
            if (!fixed[at] && !border[at]) {
              hint.at = at;
              fixed[at] = pieceMask(piece);
              break;
            }
          }
          break;
      }
    } while (rng.intValue(3) < 1);

    prepareInitialPossibilities();
  }

  void randomize(Rng &rng) {
    for (int piece = 0; piece < pieceCount; piece++) {
      while (true) {
        int at = rng.intValue(totalCells());
        int size = 2 + rng.intValue(4);
        if (!fixed[at] && !border[at]) {
          hints[piece] = Hint{at, size};
          fixed[at] = pieceMask(piece);
          break;
        }
      }
    }
  }

  void validate() {
    std::vector<int> counts(pieceCount);
    for (int piece = 0; piece < pieceCount; piece++) {
      if (orientationCount(piece) != 1) {
        throw std::runtime_error("Cannot validate unresolved orientation");
      }
      int orientation = trailingZeroCount(validOrientation[piece]);
      for (int at : pieceOrientationCellsForPiece(piece, orientation)) {
        if (fixed[at] && fixed[at] != pieceMask(piece)) {
          throw std::runtime_error("Solved puzzle has intersecting pieces");
        }
        fixed[at] = pieceMask(piece);
      }
    }

    for (int at = 0; at < totalCells(); at++) {
      if (forced[at] && !fixed[at]) {
        throw std::runtime_error("Solved puzzle has uncovered forced square");
      }
      if (fixed[at]) {
        counts[maskToPiece(fixed[at])]++;
      }
    }

    for (int piece = 0; piece < pieceCount; piece++) {
      if (counts[piece] != hints[piece].size) {
        throw std::runtime_error("Solved puzzle has incorrect piece size");
      }
    }
  }

  int origPossibleCount(int at) const {
    return bitCount(origPossible[at]);
  }

  int possibleCount(int at) const {
    return bitCount(possible[at]);
  }

  void updatePossible() {
    for (int piece = 0; piece < pieceCount; piece++) {
      updatePossibleForPiece(piece);
    }
  }

  void updatePossibleForPiece(int piece) {
    uint32_t mask = pieceMask(piece);
    int size = hints[piece].size;
    uint32_t valid = validOrientation[piece];

    for (int orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1u << orientation))) continue;

      int count = 0;
      const auto &cells = pieceOrientationCellsForPiece(piece, orientation);
      for (int at : cells) {
        if (!fixed[at] || fixed[at] == mask) count++;
      }

      if (count == size) {
        for (int at : cells) {
          possible[at] |= mask;
        }
      } else {
        validOrientation[piece] &= ~(1u << orientation);
      }
    }
  }

  int updateForcedCoverage() {
    int count = 0;
    for (int piece = 0; piece < pieceCount; piece++) {
      count += updateForcedCoverageForPiece(piece);
    }
    return count;
  }

  int updateForcedCoverageForPiece(int piece) {
    uint32_t mask = pieceMask(piece);
    int updated = 0;
    for (int at : pieceCellsForPiece(piece)) {
      if (!fixed[at] && forced[at] && possible[at] == mask) {
        updated = 1;
        fixed[at] = mask;
        updateNotPossible(at, piece);
      }
    }
    return updated;
  }

  int updateCantFit() {
    int count = 0;
    for (int piece = 0; piece < pieceCount; piece++) {
      count += updateCantFitForPiece(piece);
    }
    return count;
  }

  int updateCantFitForPiece(int piece) {
    uint32_t mask = pieceMask(piece);
    int size = hints[piece].size;
    uint32_t valid = validOrientation[piece];
    int validCount = 0;

    if (!valid) return 0;
    std::fill(countScratch.begin(), countScratch.end(), 0);

    for (int orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1u << orientation))) continue;

      bool ok = true;
      const auto &cells = pieceOrientationCellsForPiece(piece, orientation);
      for (int at : cells) {
        if (!(possible[at] & mask)) ok = false;
      }
      if (ok) {
        validCount++;
        for (int at : cells) {
          countScratch[at]++;
        }
      }
    }

    int updated = 0;
    for (int at : pieceCellsForPiece(piece)) {
      if (!fixed[at] && countScratch[at] == validCount) {
        updated = 1;
        fixed[at] = mask;
        updateNotPossible(at, piece);
      }
    }
    return updated;
  }

  void updateNotPossible(int updateAt, int piece) {
    int size = hints[piece].size;
    uint32_t valid = validOrientation[piece];
    for (int orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1u << orientation))) continue;

      bool intersects = false;
      for (int at : pieceOrientationCellsForPiece(piece, orientation)) {
        if (at == updateAt) intersects = true;
      }
      if (!intersects) {
        validOrientation[piece] &= ~(1u << orientation);
      }
    }
  }

  uint32_t initValidOrientations(int piece) {
    int size = hints[piece].size;
    uint32_t valid = 0;
    for (int orientation = 0; orientation < size * 2; orientation++) {
      int count = 0;
      for (int at : pieceOrientationCellsForPiece(piece, orientation)) {
        if (!border[at] && (!fixed[at] || fixed[at] == pieceMask(piece))) {
          count++;
        }
      }
      if (count == size) {
        valid |= 1u << orientation;
      }
    }
    return valid;
  }

  int updateUncontestedNoCover() {
    for (int piece = 0; piece < pieceCount; piece++) {
      uint32_t orientationMask = findUncontestedNoCover(piece);
      if (!orientationMask) continue;
      validOrientation[piece] = orientationMask;
      int orientation = trailingZeroCount(orientationMask);
      for (int at : pieceOrientationCellsForPiece(piece, orientation)) {
        if (!fixed[at]) {
          fixed[at] = pieceMask(piece);
          updateNotPossible(at, piece);
        }
      }
      return 1;
    }
    return 0;
  }

  uint32_t findUncontestedNoCover(int piece) {
    uint32_t mask = pieceMask(piece);
    bool haveContested = false;

    for (int at : pieceCellsForPiece(piece)) {
      if (!fixed[at] && forced[at] && (possible[at] & mask)) {
        return 0;
      }
      if ((possible[at] & mask) && possible[at] != mask) {
        haveContested = true;
      }
    }

    if (!haveContested) return 0;

    int size = hints[piece].size;
    uint32_t valid = validOrientation[piece];
    for (int orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1u << orientation))) continue;

      bool ok = true;
      bool nonFixed = false;
      for (int at : pieceOrientationCellsForPiece(piece, orientation)) {
        if (fixed[at]) {
          if (fixed[at] != mask) ok = false;
        } else {
          nonFixed = true;
          if (possible[at] != mask) ok = false;
        }
      }
      if (ok && nonFixed) return 1u << orientation;
    }

    return 0;
  }

  int updateKnowledgeOfSingleSolution() {
    int count = 0;
    for (int piece = 0; piece < pieceCount; piece++) {
      count += findKnowledgeOfSingleSolution(piece);
    }
    return count;
  }

  int findKnowledgeOfSingleSolution(int piece) {
    auto &haveInformationUnion = cellSetScratch;
    int haveInformationCount = 0;
    int noInformationCount = 0;
    std::fill(haveInformationUnion.begin(), haveInformationUnion.end(), 0);

    int size = hints[piece].size;
    uint32_t valid = validOrientation[piece];
    for (int orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1u << orientation))) continue;

      const auto &cells = pieceOrientationCellsForPiece(piece, orientation);
      bool ok = true;
      bool overlapsForced = false;
      bool cantOverlapWithOtherPieces = true;
      for (int at : cells) {
        if (!fixed[at]) {
          if (forced[at]) overlapsForced = true;
          if (possibleCount(at) != 1) cantOverlapWithOtherPieces = false;
        } else if (fixed[at] != pieceMask(piece)) {
          ok = false;
        }
      }
      if (!ok) continue;

      if (overlapsForced) {
        if (haveInformationCount) {
          std::fill(markScratch.begin(), markScratch.end(), 0);
          for (int at : cells) markScratch[at] = 1;
          for (int at = 0; at < totalCells(); at++) {
            haveInformationUnion[at] =
                haveInformationUnion[at] && markScratch[at] ? 1 : 0;
          }
        } else {
          for (int at : cells) haveInformationUnion[at] = 1;
        }
        haveInformationCount++;
      } else if (cantOverlapWithOtherPieces) {
        noInformationCount++;
      }
    }

    if (noInformationCount > 1) {
      int updateCount = 0;
      for (int at : pieceCellsForPiece(piece)) {
        if (fixed[at]) continue;
        if (haveInformationUnion[at]) {
          fixed[at] = pieceMask(piece);
          updateNotPossible(at, piece);
          updateCount++;
        }
      }
      return updateCount;
    }
    return 0;
  }

  void updateDependent() {
    for (int at = 0; at < totalCells(); at++) {
      if (!forced[at] || fixed[at] || possibleCount(at) <= 1) {
        continue;
      }

      auto &dep = cellSetScratch;
      std::fill(dep.begin(), dep.end(), 1);
      for (int piece = 0; piece < pieceCount; piece++) {
        if (!(pieceMask(piece) & possible[at])) continue;
        auto pieceDep = findDependent(piece, at);
        for (int index = 0; index < totalCells(); index++) {
          dep[index] = dep[index] && pieceDep[index] ? 1 : 0;
        }
      }

      int depCount = 0;
      for (int index = 0; index < totalCells(); index++) {
        if (dep[index]) depCount++;
      }

      if (depCount > 1) {
        for (int target = 0; target < pieceCount; target++) {
          if (dep[target] && target != at &&
              possible[at] != possible[target] && forced[target]) {
            uint32_t shared = possible[target] & possible[at];
            possible[target] = shared;
            possible[at] = shared;
          }
        }
      }
    }
  }

  std::vector<uint8_t> findOneOf(int piece, int target) {
    return findDependent(piece, target, false);
  }

  std::vector<uint8_t> findDependent(
      int piece,
      int target,
      bool wantedOverlap = true) {
    uint32_t mask = pieceMask(piece);
    int size = hints[piece].size;
    uint32_t valid = validOrientation[piece];
    std::vector<uint8_t> ret;

    for (int orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1u << orientation))) continue;

      const auto &cells = pieceOrientationCellsForPiece(piece, orientation);
      bool overlapsTarget = false;
      bool ok = true;
      for (int at : cells) {
        if (at == target) overlapsTarget = true;
        if (fixed[at] && fixed[at] != mask) ok = false;
      }
      if (overlapsTarget == wantedOverlap && ok) {
        if (!ret.empty()) {
          std::fill(markScratch.begin(), markScratch.end(), 0);
          for (int at : cells) markScratch[at] = 1;
          for (int at = 0; at < totalCells(); at++) {
            ret[at] = ret[at] && markScratch[at] ? 1 : 0;
          }
        } else {
          ret.assign(totalCells(), 0);
          for (int at : cells) {
            ret[at] = 1;
          }
        }
      }
    }

    if (ret.empty()) {
      ret.assign(totalCells(), 0);
    }
    return ret;
  }

  void updateSquare() {
    for (int piece = 0; piece < pieceCount; piece++) {
      int size = hints[piece].size;
      std::vector<int> covered;

      for (int at : pieceCellsForPiece(piece)) {
        if (forced[at] && !fixed[at] && possibleCount(at) == 2 &&
            (possible[at] & pieceMask(piece))) {
          covered.push_back(at);
        }
      }

      for (int i = 0; i < static_cast<int>(covered.size()); i++) {
        for (int j = i + 1; j < static_cast<int>(covered.size()); j++) {
          int ai = covered[i];
          int aj = covered[j];
          if (distance(ai, aj) <= size) continue;
          if (possible[ai] != possible[aj]) continue;

          uint32_t valid = validOrientation[piece];
          for (int orientation = 0; orientation < size * 2; orientation++) {
            if (!(valid & (1u << orientation))) continue;

            bool missesBoth = true;
            for (int at : pieceOrientationCellsForPiece(piece, orientation)) {
              if (at == ai || at == aj) missesBoth = false;
            }
            if (missesBoth) {
              validOrientation[piece] &= ~(1u << orientation);
            }
          }
        }
      }
    }
  }

  void updateOneOf() {
    for (int at = 0; at < totalCells(); at++) {
      if (fixed[at] || possibleCount(at) < 2) continue;

      auto pair = findPiecesOnSameRowOrColumn(at);
      if (pair.first < 0) continue;

      int pieceA = pair.first;
      int pieceB = pair.second;
      auto a = findOneOf(pieceA, at);
      auto b = findOneOf(pieceB, at);
      uint32_t targetPiecesA = 0;
      uint32_t targetPiecesB = 0;

      for (int target = 0; target < totalCells(); target++) {
        if (!a[target] && !b[target]) continue;
        for (int piece = 0; piece < pieceCount; piece++) {
          if (piece == pieceA || piece == pieceB) continue;
          if (pieceMask(piece) & possible[target]) {
            if (a[target]) targetPiecesA |= pieceMask(piece);
            if (b[target]) targetPiecesB |= pieceMask(piece);
          }
        }
      }

      uint32_t targetPiecesBoth = targetPiecesA & targetPiecesB;
      if (targetPiecesBoth) {
        for (int piece = 0; piece < pieceCount; piece++) {
          if (pieceMask(piece) & targetPiecesBoth) {
            excludeIfInBothSets(piece, a, b);
          }
        }
      }
    }
  }

  std::pair<int, int> findPiecesOnSameRowOrColumn(int at) {
    uint32_t possibleMask = possible[at];
    for (int i = 0; i < pieceCount; i++) {
      if (!(possibleMask & pieceMask(i))) continue;
      for (int j = i + 1; j < pieceCount; j++) {
        if (!(possibleMask & pieceMask(j))) continue;
        int aAt = hints[i].at;
        int bAt = hints[j].at;
        if (std::floor(aAt / internalWidth) == std::floor(bAt / internalWidth) ||
            aAt % internalWidth == bAt % internalWidth) {
          return {i, j};
        }
      }
    }
    return {-1, -1};
  }

  void excludeIfInBothSets(
      int piece,
      const std::vector<uint8_t> &a,
      const std::vector<uint8_t> &b) {
    uint32_t mask = pieceMask(piece);
    int size = hints[piece].size;
    uint32_t valid = validOrientation[piece];

    for (int orientation = 0; orientation < size * 2; orientation++) {
      if (!(valid & (1u << orientation))) continue;

      bool aHit = false;
      bool bHit = false;
      bool ok = true;
      for (int at : pieceOrientationCellsForPiece(piece, orientation)) {
        if (a[at]) aHit = true;
        if (b[at]) bHit = true;
        if (fixed[at] && fixed[at] != mask) ok = false;
      }
      if (ok && aHit && bHit) {
        validOrientation[piece] &= ~(1u << orientation);
      }
    }
  }

  int distance(int a, int b) const {
    int rowA = static_cast<int>(std::floor(a / internalWidth));
    int rowB = static_cast<int>(std::floor(b / internalWidth));
    int colA = a % internalWidth;
    int colB = b % internalWidth;
    int rowDistance = std::abs(rowA - rowB);
    int colDistance = std::abs(colA - colB);
    if (rowDistance && colDistance) return internalWidth + height + 1;
    return rowDistance + colDistance;
  }

  const std::vector<int> &pieceOrientationCellsForPiece(
      int piece,
      int orientation) {
    ensurePieceCellCache(piece);
    static const std::vector<int> empty;
    if (orientation < 0 ||
        orientation >=
            static_cast<int>(pieceOrientationCellsCache[piece].size())) {
      return empty;
    }
    return pieceOrientationCellsCache[piece][orientation];
  }

  const std::vector<int> &pieceCellsForPiece(int piece) {
    ensurePieceCellCache(piece);
    return pieceCellsCache[piece];
  }

  void ensurePieceCellCache(int piece) {
    const Hint &hint = hints[piece];
    if (cachedHintAt[piece] == hint.at &&
        cachedHintSize[piece] == hint.size) {
      return;
    }

    cachedHintAt[piece] = hint.at;
    cachedHintSize[piece] = hint.size;
    pieceCellsCache[piece] = computePieceCells(hint);
    pieceOrientationCellsCache[piece].clear();
    pieceOrientationCellsCache[piece].reserve(hint.size * 2);
    for (int orientation = 0; orientation < hint.size * 2; orientation++) {
      pieceOrientationCellsCache[piece].push_back(
          computePieceOrientationCells(hint, orientation));
    }
  }

  std::vector<int> computePieceOrientationCells(
      const Hint &hint,
      int orientation) const {
    int size = hint.size;
    int offset = size - 1 - (orientation >> 1);
    int step = orientation & 1 ? internalWidth : 1;
    int start = hint.at - offset * step;
    int end = start + size * step;

    if (start < 0 || end >= totalCells() + step) {
      return {};
    }

    std::vector<int> cells;
    cells.reserve(size);
    for (int at = start; at != end; at += step) {
      cells.push_back(at);
    }
    return cells;
  }

  std::vector<int> computePieceCells(const Hint &hint) const {
    std::vector<int> cells;
    cells.reserve(hint.size * 2 - 1);
    cells.push_back(hint.at);
    int row = static_cast<int>(std::floor(hint.at / internalWidth));
    int col = hint.at % internalWidth;
    int size = hint.size;

    for (int candidateRow = std::max(0, row - (size - 1));
         candidateRow < std::min(height, row + size);
         candidateRow++) {
      int at = candidateRow * internalWidth + col;
      if (at != hint.at) cells.push_back(at);
    }

    for (int candidateCol = std::max(0, col - (size - 1));
         candidateCol < std::min(internalWidth, col + size);
         candidateCol++) {
      int at = candidateCol + row * internalWidth;
      if (at != hint.at) cells.push_back(at);
    }

    return cells;
  }
};

Classification classifyGame(const GeneratorGame &input, Profile *profile) {
  if (profile) profile->classifications++;
  GeneratorGame game = input;
  Classification classification;
  game.resetHints();

  while (true) {
    IterationResult result = game.iterate();
    if (result.kind == DeductionKind::None) return classification;

    auto updateMeta = [&](Meta &meta) {
      meta.depth++;
      meta.maxWidth = std::max(meta.maxWidth, result.count);
    };

    switch (result.kind) {
      case DeductionKind::Cover:
        updateMeta(classification.cover);
        break;
      case DeductionKind::CantFit:
        updateMeta(classification.cantFit);
        break;
      case DeductionKind::Square:
        updateMeta(classification.square);
        break;
      case DeductionKind::Dependency:
        updateMeta(classification.dep);
        break;
      case DeductionKind::OneOf:
        updateMeta(classification.oneOf);
        break;
      case DeductionKind::SingleSolution:
        updateMeta(classification.singleSolution);
        break;
      case DeductionKind::UncontestedNoCover:
        updateMeta(classification.uncontestedNoCover);
        break;
      case DeductionKind::None:
        break;
    }

    classification.all.depth++;
    classification.all.maxWidth =
        std::max(classification.all.maxWidth, result.count);

    if (game.solved()) {
      classification.solved = true;
      break;
    }
    if (game.impossible()) break;
  }

  return classification;
}

GeneratorGame addForcedSquares(const GeneratorGame &input, Rng &rng) {
  GeneratorGame game = input;
  for (int index = 0; index < 100; index++) {
    game.forceIfUncontested(rng);
    IterationResult result = game.iterate();
    if (result.kind == DeductionKind::None) {
      if (!game.forceOneSquare(rng)) break;
    }
    if (game.impossible()) break;
  }
  return game;
}

int optimizationScore(
    const Classification &classification,
    const DifficultyVariant &variant) {
  return classification.cover.depth * variant.scoreCover +
      classification.cantFit.depth * variant.scoreCantFit +
      classification.square.depth * variant.scoreSquare +
      classification.dep.depth * variant.scoreDep +
      classification.oneOf.depth * variant.scoreOneOf +
      classification.singleSolution.depth * variant.scoreSingleSolution +
      classification.uncontestedNoCover.depth *
          variant.scoreUncontestedNoCover +
      classification.all.maxWidth * variant.scoreMaxWidth;
}

int collectionScore(
    const Classification &classification,
    const DifficultySpec &spec) {
  double bonus = 0.0;
  switch (spec.mode) {
    case Mode::Small:
      bonus = classification.cantFit.depth * 1.25;
      break;
    case Mode::Medium:
      bonus = classification.cantFit.depth * 1.1;
      break;
    case Mode::Expert:
      bonus = 1.0;
      break;
    case Mode::Extraordinary:
      bonus = 1.0;
      break;
    case Mode::Large:
      bonus = 0.0;
      break;
  }

  return static_cast<int>(std::floor(
      bonus +
      classification.cover.depth +
      classification.cantFit.depth +
      classification.square.depth * 10 +
      classification.dep.depth * 50 +
      classification.oneOf.depth * 20 +
      classification.singleSolution.depth * -200 +
      classification.uncontestedNoCover.depth * -50 +
      classification.all.maxWidth * -2));
}

bool hasAdvancedDeduction(const Classification &classification) {
  return classification.square.depth > 0 ||
      classification.oneOf.depth > 0 ||
      classification.dep.depth > 0;
}

bool accepts(const DifficultySpec &spec, const Classification &classification) {
  if (!classification.solved) return false;
  switch (spec.mode) {
    case Mode::Small:
      return classification.cover.depth > 1 &&
          classification.square.depth == 0 && classification.dep.depth == 0 &&
          classification.oneOf.depth == 0;
    case Mode::Medium:
      return classification.cover.depth > 5 &&
          classification.square.depth == 0 && classification.dep.depth == 0 &&
          classification.oneOf.depth == 0;
    case Mode::Large:
      return classification.square.depth > 0 &&
          classification.dep.depth == 0 && classification.oneOf.depth == 0;
    case Mode::Expert:
      return classification.solved;
    case Mode::Extraordinary:
      // Large's board, but the difficulty must come from the advanced chain
      // deductions, not merely be permitted to.
      return classification.dep.depth > 0 || classification.oneOf.depth > 0;
  }
  return false;
}

std::vector<int> range(int start, int end) {
  std::vector<int> values;
  for (int value = start; value <= end; value++) values.push_back(value);
  return values;
}

DifficultyVariant baseVariant(DifficultyVariant variant) {
  return variant;
}

DifficultySpec createSpec(const std::string &mode) {
  if (mode == "small") {
    DifficultySpec spec{Mode::Small, mode};
    for (int pieces : range(7, 10)) {
      spec.variants.push_back(baseVariant(DifficultyVariant{
          9, 6, pieces, 1, 1, 0, 0, 0, -1, -50, -1, 0}));
      spec.variants.push_back(baseVariant(DifficultyVariant{
          9, 6, pieces, 1, 3, 0, 0, 0, -1, -50, -1, 0}));
    }
    return spec;
  }
  if (mode == "medium") {
    DifficultySpec spec{Mode::Medium, mode};
    for (int pieces : range(15, 20)) {
      spec.variants.push_back(baseVariant(DifficultyVariant{
          10, 7, pieces, 1, 3, 0, 0, 0, -1, -50, -1, 25}));
    }
    return spec;
  }
  if (mode == "large") {
    DifficultySpec spec{Mode::Large, mode};
    spec.requireAdvancedCandidate = true;
    for (int pieces : range(19, 22)) {
      spec.variants.push_back(baseVariant(DifficultyVariant{
          11, 8, pieces, 1, 3, 50, 0, 0, -2, -50, -1, 50}));
    }
    return spec;
  }
  if (mode == "expert") {
    DifficultySpec spec{Mode::Expert, mode};
    spec.requireAdvancedCandidate = true;
    for (int pieces : range(23, 26)) {
      spec.variants.push_back(baseVariant(DifficultyVariant{
          13, 9, pieces, 1, 3, 50, 100, 60, -2, -50, -1, 50}));
    }
    return spec;
  }
  if (mode == "extraordinary") {
    // The 11x8 board of "large", with the dep/one-of scoring of "expert":
    // harder logic on the same screen footprint.
    DifficultySpec spec{Mode::Extraordinary, mode};
    spec.requireAdvancedCandidate = true;
    for (int pieces : range(19, 22)) {
      spec.variants.push_back(baseVariant(DifficultyVariant{
          11, 8, pieces, 1, 3, 50, 100, 60, -2, -50, -1, 50}));
    }
    return spec;
  }
  throw std::runtime_error("Unknown puzzle difficulty");
}

struct CandidateResult {
  GeneratorGame game;
  Classification classification;
};

CandidateResult createCandidateGame(
    const DifficultyVariant &variant,
    Rng &rng,
    int attemptLimit,
    bool requireAdvancedDeduction,
    Profile *profile,
    bool &found) {
  for (int attempt = 0; attempt < attemptLimit; attempt++) {
    if (profile) profile->candidateAttempts++;
    GeneratorGame game = GeneratorGame::random(
        variant.height,
        variant.width,
        variant.pieces,
        rng);
    GeneratorGame candidate = addForcedSquares(game, rng);

    if (candidate.solved()) {
      if (profile) profile->solvedCandidates++;
      Classification classification = classifyGame(candidate, profile);
      if (!classification.solved) continue;
      if (requireAdvancedDeduction && !hasAdvancedDeduction(classification)) {
        if (profile) profile->rejectedCandidatesWithoutAdvancedDeduction++;
        continue;
      }
      found = true;
      return {candidate, classification};
    }
  }

  found = false;
  return {GeneratorGame(1, 1, 1), Classification{}};
}

struct OptimizationResult {
  GeneratorGame game;
  Classification classification;
  int score = 0;
};

struct GeneratedPuzzle {
  std::vector<std::string> rows;
  int score = 0;
};

OptimizationResult optimizeGame(
    const GeneratorGame &input,
    const Classification &initialClassification,
    const DifficultyVariant &variant,
    Rng &rng,
    Profile *profile) {
  int iterations = variant.optimizeIterations;
  if (!iterations) {
    return {input, initialClassification, optimizationScore(initialClassification, variant)};
  }

  std::vector<OptimizationResult> results;
  results.push_back({
      input,
      initialClassification,
      optimizationScore(initialClassification, variant),
  });

  auto pushResult = [&](OptimizationResult result) {
    auto it = std::find_if(
        results.begin(),
        results.end(),
        [&](const OptimizationResult &current) {
          return result.score > current.score;
        });
    if (it == results.end()) {
      if (results.size() < 10) results.push_back(std::move(result));
    } else {
      results.insert(it, std::move(result));
      if (results.size() > 10) results.pop_back();
    }
  };

  for (int index = 0; index < iterations; index++) {
    if (profile) profile->optimizationIterations++;
    GeneratorGame base = results[rng.intValue(static_cast<int>(results.size()))].game;
    base.resetForced();
    base.mutate(rng);
    GeneratorGame optimized = addForcedSquares(base, rng);
    Classification classification = classifyGame(optimized, profile);

    if (classification.solved) {
      pushResult({
          optimized,
          classification,
          optimizationScore(classification, variant),
      });
    }
  }

  return results[0];
}

std::optional<GeneratedPuzzle> generatePuzzleRecord(
    const std::string &mode,
    uint32_t seed,
    int attemptLimit,
    int candidateAttemptLimit,
    int optimizeIterationsOverride,
    bool hasOptimizeIterationsOverride,
    bool requireAdvancedCandidateOverride,
    bool hasRequireAdvancedCandidateOverride,
    Profile *profile) {
  DifficultySpec spec = createSpec(mode);
  Rng rng(seed);
  bool requireAdvancedCandidate = hasRequireAdvancedCandidateOverride
      ? requireAdvancedCandidateOverride
      : spec.requireAdvancedCandidate;

  for (int attempt = 0; attempt < attemptLimit; attempt++) {
    if (profile) profile->topLevelAttempts++;
    DifficultyVariant variant =
        spec.variants[rng.intValue(static_cast<int>(spec.variants.size()))];
    if (hasOptimizeIterationsOverride) {
      variant.optimizeIterations = optimizeIterationsOverride;
    }

    bool found = false;
    CandidateResult candidate = createCandidateGame(
        variant,
        rng,
        candidateAttemptLimit,
        requireAdvancedCandidate,
        profile,
        found);
    if (!found) continue;

    OptimizationResult optimized = optimizeGame(
        candidate.game,
        candidate.classification,
        variant,
        rng,
        profile);
    if (!accepts(spec, optimized.classification)) {
      if (profile) profile->rejectedUnacceptedPuzzles++;
      continue;
    }

    return GeneratedPuzzle{
        optimized.game.toRows(),
        collectionScore(optimized.classification, spec),
    };
  }

  return std::nullopt;
}

bool generatePuzzle(
    const std::string &mode,
    uint32_t seed,
    int attemptLimit,
    int candidateAttemptLimit,
    int optimizeIterationsOverride,
    bool hasOptimizeIterationsOverride,
    bool requireAdvancedCandidateOverride,
    bool hasRequireAdvancedCandidateOverride,
    Profile *profile) {
  return generatePuzzleRecord(
      mode,
      seed,
      attemptLimit,
      candidateAttemptLimit,
      optimizeIterationsOverride,
      hasOptimizeIterationsOverride,
      requireAdvancedCandidateOverride,
      hasRequireAdvancedCandidateOverride,
      profile)
      .has_value();
}

std::string escapeJsonString(const std::string &value) {
  std::string escaped;
  escaped.reserve(value.size() + 2);
  for (char ch : value) {
    switch (ch) {
      case '\\':
        escaped += "\\\\";
        break;
      case '"':
        escaped += "\\\"";
        break;
      default:
        escaped.push_back(ch);
        break;
    }
  }
  return escaped;
}

std::string generatePuzzleJson(const std::string &mode, uint32_t seed) {
  auto puzzle = generatePuzzleRecord(
      mode,
      seed,
      100,
      1000,
      0,
      false,
      false,
      false,
      nullptr);
  if (!puzzle) return "";

  std::string json = "{\"score\":" + std::to_string(puzzle->score) +
      ",\"rows\":[";
  for (size_t index = 0; index < puzzle->rows.size(); index++) {
    if (index) json += ',';
    json += '"';
    json += escapeJsonString(puzzle->rows[index]);
    json += '"';
  }
  json += "]}";
  return json;
}

extern "C" int ordinary_generate_puzzle_json(
    const char *mode,
    uint32_t seed,
    char *output,
    int outputLength) {
  if (!mode) return -1;

  try {
    std::string json = generatePuzzleJson(mode, seed);
    if (json.empty()) return 0;

    int requiredLength = static_cast<int>(json.size()) + 1;
    if (output && outputLength > 0) {
      int copyLength = std::min(requiredLength, outputLength) - 1;
      if (copyLength > 0) {
        std::memcpy(output, json.data(), static_cast<size_t>(copyLength));
      }
      output[copyLength] = '\0';
    }

    return requiredLength;
  } catch (...) {
    return -1;
  }
}

extern "C" int ordinary_generator_version() {
  return 1;
}

}  // namespace

#ifndef ORDINARY_GENERATOR_WASM

std::vector<std::string> split(const std::string &value, char separator) {
  std::vector<std::string> parts;
  std::string current;
  for (char c : value) {
    if (c == separator) {
      if (!current.empty()) parts.push_back(current);
      current.clear();
    } else {
      current.push_back(c);
    }
  }
  if (!current.empty()) parts.push_back(current);
  return parts;
}

std::unordered_map<std::string, std::string> parseArgs(int argc, char **argv) {
  std::unordered_map<std::string, std::string> args;
  for (int index = 1; index < argc; index++) {
    std::string arg = argv[index];
    if (arg.rfind("--", 0) != 0) continue;
    arg = arg.substr(2);
    auto equals = arg.find('=');
    if (equals == std::string::npos) {
      args[arg] = "true";
    } else {
      args[arg.substr(0, equals)] = arg.substr(equals + 1);
    }
  }
  return args;
}

double percentile(std::vector<double> values, double position) {
  std::sort(values.begin(), values.end());
  size_t index = std::min(
      values.size() - 1,
      static_cast<size_t>(std::floor(values.size() * position)));
  return values[index];
}

long long rounded(double value) {
  return static_cast<long long>(std::llround(value));
}

void printProfile(const Profile &profile) {
  std::cout << "\"candidateAttempts\":" << profile.candidateAttempts << ','
            << "\"classifications\":" << profile.classifications << ','
            << "\"optimizationIterations\":" << profile.optimizationIterations
            << ','
            << "\"rejectedCandidatesWithoutAdvancedDeduction\":"
            << profile.rejectedCandidatesWithoutAdvancedDeduction << ','
            << "\"rejectedUnacceptedPuzzles\":"
            << profile.rejectedUnacceptedPuzzles << ','
            << "\"solvedCandidates\":" << profile.solvedCandidates << ','
            << "\"topLevelAttempts\":" << profile.topLevelAttempts;
}

int main(int argc, char **argv) {
  auto args = parseArgs(argc, argv);
  std::vector<std::string> modes =
      split(args.count("modes") ? args["modes"] : "small,medium,large", ',');
  int defaultSamples = args.count("samples") ? std::stoi(args["samples"]) : 10;
  int largeSamples =
      args.count("large-samples") ? std::stoi(args["large-samples"]) : 3;
  int attemptLimit =
      args.count("attempt-limit") ? std::stoi(args["attempt-limit"]) : 100;
  int candidateAttemptLimit = args.count("candidate-attempt-limit")
      ? std::stoi(args["candidate-attempt-limit"])
      : 1000;
  bool hasOptimizeIterationsOverride = args.count("optimize-iterations") > 0;
  int optimizeIterationsOverride = hasOptimizeIterationsOverride
      ? std::stoi(args["optimize-iterations"])
      : 0;
  bool hasRequireAdvancedCandidateOverride =
      args.count("require-advanced-candidate") > 0;
  bool requireAdvancedCandidateOverride = hasRequireAdvancedCandidateOverride &&
      args["require-advanced-candidate"] != "false";
  bool emitPuzzles = args.count("emit-puzzles") > 0;

  if (emitPuzzles) {
    int maxSeedSalts =
        args.count("max-seed-salts") ? std::stoi(args["max-seed-salts"]) : 100;
    // Lets a pack build continue a previous run without re-deriving the same
    // seeds (index feeds the seed hash).
    int indexOffset =
        args.count("index-offset") ? std::stoi(args["index-offset"]) : 0;

    for (const std::string &mode : modes) {
      int sampleCount = mode == "large" ? largeSamples : defaultSamples;
      if (mode == "expert") sampleCount = defaultSamples;

      for (int index = indexOffset; index < indexOffset + sampleCount;
           index++) {
        bool emitted = false;
        for (int salt = 0; salt < maxSeedSalts; salt++) {
          uint32_t seed = hashSeed(
              mode + ":" + std::to_string(index) + ":" +
              std::to_string(salt));
          std::string puzzleJson = generatePuzzleJson(mode, seed);
          if (puzzleJson.empty()) continue;

          std::cout << "{"
                    << "\"mode\":\"" << escapeJsonString(mode) << "\","
                    << "\"index\":" << index << ','
                    << "\"seed\":" << seed << ','
                    << "\"salt\":" << salt << ','
                    << "\"puzzle\":" << puzzleJson << "}" << std::endl;
          emitted = true;
          break;
        }

        if (!emitted) {
          std::cout << "{"
                    << "\"mode\":\"" << escapeJsonString(mode) << "\","
                    << "\"index\":" << index << ','
                    << "\"error\":\"unable_to_generate\"}" << std::endl;
        }
      }
    }

    return 0;
  }

  for (const std::string &mode : modes) {
    int sampleCount = mode == "large" ? largeSamples : defaultSamples;
    if (mode == "expert") sampleCount = defaultSamples;

    struct Result {
      bool accepted;
      int index;
      double ms;
      Profile profile;
      uint32_t seed;
    };
    std::vector<Result> results;

    for (int index = 0; index < sampleCount; index++) {
      Profile profile;
      uint32_t seed = hashSeed(mode + ":" + std::to_string(index) + ":0");
      auto start = std::chrono::steady_clock::now();
      bool accepted = generatePuzzle(
          mode,
          seed,
          attemptLimit,
          candidateAttemptLimit,
          optimizeIterationsOverride,
          hasOptimizeIterationsOverride,
          requireAdvancedCandidateOverride,
          hasRequireAdvancedCandidateOverride,
          &profile);
      auto end = std::chrono::steady_clock::now();
      double ms =
          std::chrono::duration<double, std::milli>(end - start).count();
      results.push_back({accepted, index, ms, profile, seed});
    }

    int accepted = 0;
    std::vector<double> timings;
    Profile totals;
    for (const auto &result : results) {
      if (result.accepted) accepted++;
      timings.push_back(result.ms);
      totals.candidateAttempts += result.profile.candidateAttempts;
      totals.classifications += result.profile.classifications;
      totals.optimizationIterations += result.profile.optimizationIterations;
      totals.rejectedCandidatesWithoutAdvancedDeduction +=
          result.profile.rejectedCandidatesWithoutAdvancedDeduction;
      totals.rejectedUnacceptedPuzzles +=
          result.profile.rejectedUnacceptedPuzzles;
      totals.solvedCandidates += result.profile.solvedCandidates;
      totals.topLevelAttempts += result.profile.topLevelAttempts;
    }

    std::vector<double> sorted = timings;
    std::sort(sorted.begin(), sorted.end());
    double sum = std::accumulate(timings.begin(), timings.end(), 0.0);

    std::vector<Result> slowest = results;
    std::sort(slowest.begin(), slowest.end(), [](const Result &a, const Result &b) {
      return a.ms > b.ms;
    });

    std::cout << "{"
              << "\"accepted\":" << accepted << ','
              << "\"failed\":" << (static_cast<int>(results.size()) - accepted)
              << ','
              << "\"mode\":\"" << mode << "\","
              << "\"samples\":" << sampleCount << ','
              << "\"timings\":{"
              << "\"avgMs\":" << rounded(sum / timings.size()) << ','
              << "\"maxMs\":" << rounded(sorted.back()) << ','
              << "\"minMs\":" << rounded(sorted.front()) << ','
              << "\"p50Ms\":" << rounded(percentile(timings, 0.5)) << ','
              << "\"p90Ms\":" << rounded(percentile(timings, 0.9))
              << "},"
              << "\"profileTotals\":{";
    printProfile(totals);
    std::cout << "},\"slowest\":[";
    for (size_t index = 0; index < std::min<size_t>(3, slowest.size()); index++) {
      if (index) std::cout << ',';
      const auto &result = slowest[index];
      std::cout << "{"
                << "\"accepted\":" << (result.accepted ? "true" : "false")
                << ",\"index\":" << result.index
                << ",\"ms\":" << rounded(result.ms)
                << ",\"profile\":{";
      printProfile(result.profile);
      std::cout << "},\"seed\":" << result.seed << "}";
    }
    std::cout << "]}" << std::endl;
  }

  return 0;
}

#endif
