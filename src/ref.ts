import type { RefLike } from "./types.js";

/**
 * Why a plain object and not defuss's store-backed Ref: morph only ever assigns `current`, and the forwardRef
 * pattern needs one free slot for a component's API, so `{ current, state }` is all a ref has to be; defuss's richer
 * Ref stays assignable to it (RefLike). VERIFIED: src/reactive.test.ts keeps `current` on the same node across
 * morphs and drives a component through `ref.state`.
 *
 * A reference to a rendered element. morph sets `current` when it creates or patches the element that carries
 * `ref={...}`; a morph that keeps the element keeps `current` pointing at the same node. `state` is free for the
 * component that owns the element: the forwardRef pattern puts the component's API there, for its parent to call.
 */
export interface Ref<T extends Element = HTMLElement, S = unknown> extends RefLike {
  current: T | null;
  state?: S;
}

/**
 * Creates an empty {@link Ref}. `current` stays `null` until morph renders the element that carries it, so read it
 * in an event handler, in `onMount` or after the morph call, not in the component body.
 */
export const createRef = <T extends Element = HTMLElement, S = unknown>(state?: S): Ref<T, S> => ({
  current: null,
  state,
});

/** True for objects with a `current` property, the shape morph assigns refs to. */
export const isRef = (value: unknown): value is RefLike =>
  typeof value === "object" && value !== null && "current" in value;
