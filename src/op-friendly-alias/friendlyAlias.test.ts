import { createFriendlyAlias, formatFriendlyAlias } from "./index";

describe("friendly aliases", () => {
  it("generates deterministic aliases from a seed", () => {
    expect(createFriendlyAlias(12345)).toBe(createFriendlyAlias(12345));
    expect(createFriendlyAlias(12345)).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it("supports namespaces so callers can partition the same seed space", () => {
    expect(createFriendlyAlias(12345, { namespace: "small" })).not.toBe(
      createFriendlyAlias(12345, { namespace: "large" }),
    );
  });

  it("can use caller-provided word lists", () => {
    expect(
      createFriendlyAlias("seed", {
        words: {
          adjectives: ["quiet"],
          nouns: ["lantern"],
        },
      }),
    ).toBe("quiet-lantern");
  });

  it("rejects empty word lists", () => {
    expect(() =>
      createFriendlyAlias("seed", {
        words: {
          adjectives: [],
        },
      }),
    ).toThrow("Friendly alias word lists must not be empty");
  });

  it("formats aliases for display", () => {
    expect(formatFriendlyAlias("hello-world")).toBe("Hello World");
    expect(formatFriendlyAlias("quiet-lantern")).toBe("Quiet Lantern");
  });
});
