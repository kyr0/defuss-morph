/**
 * Wraps `cb` so each call runs it in a microtask, with the same arguments.
 * VERIFIED: renderer.test.ts asserts onMount has not run before that microtask.
 */
export const queueCallback = <T extends any[]>(cb: (...args: T) => void) => (...args: T) =>
  queueMicrotask(() => cb(...args));
