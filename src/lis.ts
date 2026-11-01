/**
 * Marks one longest strictly increasing subsequence of `values`, skipping negative entries (never marked).
 * Patience sorting with back links: O(n log n) time, three typed arrays of n entries.
 *
 * Why: a morph keeps the matched nodes whose old positions already increase in the new order where they are and moves
 * only the others. The longest such run means the fewest moves: every node outside it would be out of order
 * otherwise, and any node left out of it must move. VERIFIED: morph-reorder.test.ts counts the moves against an
 * independent quadratic count, for the everyday operations and for random keyed edits.
 */
export const longestIncreasingRun = (values: ArrayLike<number>): Uint8Array => {
  const n = values.length;
  const marked = new Uint8Array(n);
  // tails[k]: the index of the smallest last value of an increasing run of length k + 1 found so far
  const tails = new Int32Array(n);
  const previous = new Int32Array(n);
  let length = 0;

  for (let i = 0; i < n; i++) {
    const value = values[i];
    if (value < 0) continue;
    let low = 0;
    let high = length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (values[tails[mid]] < value) low = mid + 1;
      else high = mid;
    }
    previous[i] = low > 0 ? tails[low - 1] : -1;
    tails[low] = i;
    if (low === length) length++;
  }

  for (let i = length > 0 ? tails[length - 1] : -1; i >= 0; i = previous[i]) marked[i] = 1;
  return marked;
};
