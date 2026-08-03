import {
  classifyRows,
  createGeneratePuzzleProfile,
  difficulties,
  generatePuzzle,
  generatePuzzleAsync,
} from "./index";

jest.setTimeout(15000);

describe("op-generator Linjat compatibility", () => {
  it("classifies a known small puzzle like Linjat easy", () => {
    const classification = classifyRows([
      " 4 .2.",
      "   .2.",
      "      ",
      " ..3 5",
      "      ",
      "     .",
      "     .",
      "   . 3",
      "   3 .",
    ]);

    expect(classification.solved).toBe(true);
    expect(classification.all).toEqual({ depth: 10, maxWidth: 1 });
    expect(classification.cover).toEqual({ depth: 10, maxWidth: 1 });
    expect(classification.cantFit).toEqual({ depth: 0, maxWidth: 0 });
    expect(classification.square).toEqual({ depth: 0, maxWidth: 0 });
    expect(classification.dep).toEqual({ depth: 0, maxWidth: 0 });
    expect(classification.oneOf).toEqual({ depth: 0, maxWidth: 0 });
  });

  it("classifies a known medium puzzle with the current deduction rules", () => {
    const classification = classifyRows([
      "       ",
      "    .2 ",
      "2.  3  ",
      ".4. .  ",
      " .3..  ",
      " 2. . 3",
      "  4 2. ",
      ".3    3",
      "   5. 2",
      "4   3  ",
    ]);

    expect(classification.solved).toBe(true);
    expect(classification.all).toEqual({ depth: 17, maxWidth: 3 });
    expect(classification.cover).toEqual({ depth: 9, maxWidth: 1 });
    expect(classification.cantFit).toEqual({ depth: 3, maxWidth: 3 });
    expect(classification.square).toEqual({ depth: 0, maxWidth: 0 });
    expect(classification.dep).toEqual({ depth: 0, maxWidth: 0 });
    expect(classification.oneOf).toEqual({ depth: 0, maxWidth: 0 });
    expect(classification.singleSolution).toEqual({ depth: 2, maxWidth: 2 });
    expect(classification.uncontestedNoCover).toEqual({
      depth: 3,
      maxWidth: 1,
    });
  });

  it("classifies a known large puzzle like Linjat hard", () => {
    const classification = classifyRows([
      "4 ..   2",
      ". 3.  3.",
      "  .3  33",
      ".2.. 5  ",
      "2.2.    ",
      "3..36   ",
      ". 5..   ",
      ". .4 3 5",
      "   . 3. ",
      "     3. ",
      "5  .. 3.",
    ]);

    expect(classification.solved).toBe(true);
    expect(classification.all).toEqual({ depth: 25, maxWidth: 3 });
    expect(classification.cover).toEqual({ depth: 6, maxWidth: 3 });
    expect(classification.cantFit).toEqual({ depth: 17, maxWidth: 3 });
    expect(classification.square).toEqual({ depth: 2, maxWidth: 1 });
    expect(classification.dep).toEqual({ depth: 0, maxWidth: 0 });
    expect(classification.oneOf).toEqual({ depth: 0, maxWidth: 0 });
  });

  it("generates deterministic, accepted puzzles for a tiny smoke spec", () => {
    const puzzleA = generatePuzzle({
      mode: "small",
      seed: 1234,
      attemptLimit: 10,
      optimizeIterations: 0,
    });
    const puzzleB = generatePuzzle({
      mode: "small",
      seed: 1234,
      attemptLimit: 10,
      optimizeIterations: 0,
    });

    expect(puzzleA).toBeDefined();
    expect(puzzleA).toEqual(puzzleB);
    expect(difficulties.small.accepts(puzzleA!.classification)).toBe(true);
  });

  it("collects generation profile counters", () => {
    const profile = createGeneratePuzzleProfile();
    const puzzle = generatePuzzle({
      mode: "small",
      seed: 1234,
      attemptLimit: 10,
      optimizeIterations: 0,
      profile,
    });

    expect(puzzle).toBeDefined();
    expect(profile.topLevelAttempts).toBeGreaterThan(0);
    expect(profile.candidateAttempts).toBeGreaterThan(0);
    expect(profile.classifications).toBeGreaterThan(0);
  });

  it("yields while searching asynchronously", async () => {
    const yieldToEventLoop = jest.fn(() => Promise.resolve());

    const puzzle = await generatePuzzleAsync({
      mode: "small",
      seed: 1,
      attemptLimit: 3,
      candidateAttemptLimit: 0,
      yieldEveryAttempts: 1,
      yieldToEventLoop,
    });

    expect(puzzle).toBeUndefined();
    expect(yieldToEventLoop).toHaveBeenCalledTimes(3);
  });

  it("generates accepted large puzzles with optimization enabled", () => {
    const puzzle = generatePuzzle({
      mode: "large",
      seed: 1005,
      attemptLimit: 10,
      optimizeIterations: 10,
    });

    expect(puzzle).toBeDefined();
    expect(difficulties.large.accepts(puzzle!.classification)).toBe(true);
  });
});
