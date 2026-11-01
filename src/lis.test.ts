import { describe, expect, it } from "vitest";
import { longestIncreasingRun } from "./lis.js";

const picked = (values: number[]) => {
  const marked = longestIncreasingRun(values);
  return values.filter((_, i) => marked[i]);
};

/** The length of a longest strictly increasing subsequence, by the quadratic definition. */
const longest = (values: number[]) => {
  const ok = values.filter((v) => v >= 0);
  const best = ok.map(() => 1);
  for (let i = 0; i < ok.length; i++) for (let j = 0; j < i; j++) if (ok[j] < ok[i]) best[i] = Math.max(best[i], best[j] + 1);
  return Math.max(0, ...best);
};

describe("longestIncreasingRun", () => {
  it("marks every entry of a sorted list and nothing of an empty one", () => {
    expect(picked([0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
    expect(picked([])).toEqual([]);
  });

  it("keeps all but the two swapped entries, and one entry of a reversal", () => {
    expect(picked([0, 8, 2, 3, 4, 5, 6, 7, 1, 9])).toEqual([0, 2, 3, 4, 5, 6, 7, 9]);
    expect(picked([3, 2, 1, 0])).toHaveLength(1);
  });

  it("keeps the rows that stay when the first moves to the end", () => {
    expect(picked([1, 2, 3, 0])).toEqual([1, 2, 3]);
  });

  it("skips negative entries (rows that are created)", () => {
    const marked = longestIncreasingRun([-1, 0, -1, 1, -1]);
    expect([...marked]).toEqual([0, 1, 0, 1, 0]);
  });

  it("marks a strictly increasing run of maximal length for random input", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let round = 0; round < 300; round++) {
      const values = Array.from({ length: Math.floor(rand() * 40) }, () => Math.floor(rand() * 50) - 5);
      const run = picked(values).filter((v) => v >= 0);
      expect(picked(values).every((v) => v >= 0)).toBe(true);
      expect(run.every((v, i) => i === 0 || run[i - 1] < v)).toBe(true);
      expect(run.length).toBe(longest(values));
    }
  });
});
