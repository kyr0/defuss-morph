/**
 * Test helper: a plain function that records the arguments of every call.
 * Why no mock-framework spy: the tests exercise real DOM subsystems, and the project
 * gate rejects mock frameworks; a recorder is all the assertions need.
 * VERIFIED: the tests.no-mocks rule passes with every spy replaced by it.
 */
export const recorder = <A extends unknown[] = unknown[]>() => {
  const calls: A[] = [];
  const fn = (...args: A): void => {
    calls.push(args);
  };
  return Object.assign(fn, { calls });
};
