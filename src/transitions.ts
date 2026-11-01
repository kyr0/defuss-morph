export type TransitionType =
  | "fade"
  | "slide-left"
  | "slide-right"
  | "shake"
  | "none";

export interface TransitionStyles {
  enter: Record<string, string>;
  enterActive: Record<string, string>;
  exit: Record<string, string>;
  exitActive: Record<string, string>;
}

export type TransitionsEasing =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "step-start"
  | "step-end";

/** The `transition` option of `morph()`; every field is optional (see {@link DEFAULT_TRANSITION_CONFIG}). */
export interface TransitionConfig {
  /** Built-in animation; `"none"` keeps `morph()` synchronous. Default `"fade"`. */
  type?: TransitionType;
  /** Own style maps for the four phases (not used by `"fade"`). */
  styles?: TransitionStyles;
  /** Milliseconds per phase. Default 300. */
  duration?: number;
  /** CSS timing function. Default `"ease-in-out"`. */
  easing?: TransitionsEasing | string;
  /** Milliseconds to wait before starting. Default 0. */
  delay?: number;
  /** Animate the morphed element's parent (default) or the element itself. */
  target?: "parent" | "self";
}

const injectShakeKeyframes = (doc: Document | undefined) => {
  if (!doc) return;
  if (!doc.getElementById("defuss-shake")) {
    const style = doc.createElement("style");
    style.id = "defuss-shake";
    style.textContent =
      "@keyframes shake{0%,100%{transform:translate3d(0,0,0)}10%,30%,50%,70%,90%{transform:translate3d(-10px,0,0)}20%,40%,60%,80%{transform:translate3d(10px,0,0)}}";
    doc.head.appendChild(style);
  }
};

/** The four phase style maps of a built-in transition type (empty maps for an unknown type). */
export const getTransitionStyles = (
  type: TransitionType,
  duration: number,
  easing = "ease-in-out",
): TransitionStyles => {
  const t = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
  const styles: Record<string, TransitionStyles> = {
    fade: {
      enter: { opacity: "0", transition: t, transform: "translate3d(0,0,0)" },
      enterActive: { opacity: "1" },
      exit: { opacity: "1", transition: t, transform: "translate3d(0,0,0)" },
      exitActive: { opacity: "0" },
    },
    "slide-left": {
      enter: {
        transform: "translate3d(100%,0,0)",
        opacity: "0.5",
        transition: t,
      },
      enterActive: { transform: "translate3d(0,0,0)", opacity: "1" },
      exit: { transform: "translate3d(0,0,0)", opacity: "1", transition: t },
      exitActive: { transform: "translate3d(-100%,0,0)", opacity: "0.5" },
    },
    "slide-right": {
      enter: {
        transform: "translate3d(-100%,0,0)",
        opacity: "0.5",
        transition: t,
      },
      enterActive: { transform: "translate3d(0,0,0)", opacity: "1" },
      exit: { transform: "translate3d(0,0,0)", opacity: "1", transition: t },
      exitActive: { transform: "translate3d(100%,0,0)", opacity: "0.5" },
    },
    shake: (() => {
      injectShakeKeyframes(
        typeof document !== "undefined" ? document : undefined,
      );
      return {
        enter: {
          transform: "translate3d(0,0,0)",
          opacity: "1",
          transition: "none",
        },
        enterActive: {
          transform: "translate3d(0,0,0)",
          opacity: "1",
          animation: `shake ${duration}ms cubic-bezier(0.36,0.07,0.19,0.97)`,
        },
        exit: {
          transform: "translate3d(0,0,0)",
          opacity: "1",
          transition: "none",
        },
        exitActive: {
          transform: "translate3d(0,0,0)",
          opacity: "1",
          animation: `shake ${duration}ms cubic-bezier(0.36,0.07,0.19,0.97)`,
        },
      };
    })(),
  };
  return (
    styles[type] || { enter: {}, enterActive: {}, exit: {}, exitActive: {} }
  );
};

/** Sets each CSS property of `styles` on `el` (`style.setProperty`). */
export const applyStyles = (
  el: HTMLElement,
  styles: Record<string, string | number>,
) =>
  Object.entries(styles).forEach(([k, v]) =>
    el.style.setProperty(k, String(v)),
  );

/** Defaults merged under every transition config. */
export const DEFAULT_TRANSITION_CONFIG: TransitionConfig = {
  type: "fade",
  duration: 300,
  easing: "ease-in-out",
  delay: 0,
  target: "parent",
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const performCrossfade = async (
  element: HTMLElement,
  updateCallback: () => Promise<void>,
  duration: number,
  easing: string,
): Promise<void> => {
  const originalStyle = element.style.cssText;
  const snapshot = element.cloneNode(true) as HTMLElement;
  // realm-safe: use the element's own document (works across windows / SSR DOMs)
  const doc = element.ownerDocument;

  try {
    const rect = element.getBoundingClientRect();
    // the rect is viewport-relative, but the snapshot is positioned in the
    // document (absolute, child of <body>): add the scroll offset, or a
    // scrolled page shows the fading copy scrollY pixels away (VERIFIED: 2154 px
    // off in Chromium before this offset; transitions.browser.test.ts)
    const top = rect.top + (doc.defaultView?.scrollY ?? 0);
    const left = rect.left + (doc.defaultView?.scrollX ?? 0);

    // Position snapshot absolutely over original
    snapshot.style.cssText = `position:absolute;top:${top}px;left:${left}px;width:${rect.width}px;height:${rect.height}px;opacity:1;transition:opacity ${duration}ms ${easing};z-index:1000;`;

    // Prepare new content (initially hidden)
    element.style.opacity = "0";
    element.style.transition = `opacity ${duration}ms ${easing}`;

    // Insert snapshot and update content
    doc.body.appendChild(snapshot);
    await updateCallback();

    // Trigger simultaneous crossfade
    void element.offsetHeight;
    snapshot.style.opacity = "0";
    element.style.opacity = "1";

    await wait(duration);
    doc.body.removeChild(snapshot);
  } catch (error) {
    if (snapshot.parentElement) doc.body.removeChild(snapshot);
    throw error;
  } finally {
    element.style.cssText = originalStyle;
  }
};

/**
 * Runs `updateCallback` inside a transition on `element`. `fade` cross-fades a snapshot of the old
 * content over the new one; the other types animate out, run the update, then animate in. Styles
 * the transition set are restored afterwards, also when the update throws (the error propagates).
 */
export const performTransition = async (
  element: HTMLElement,
  updateCallback: () => Promise<void>,
  config: TransitionConfig = {},
): Promise<void> => {
  const {
    type = "fade",
    duration = 300,
    easing = "ease-in-out",
    delay = 0,
  } = { ...DEFAULT_TRANSITION_CONFIG, ...config };

  if (type === "none") {
    await updateCallback();
    return;
  }

  if (delay > 0) await wait(delay);

  // Use crossfade for fade transitions
  if (type === "fade") {
    await performCrossfade(element, updateCallback, duration, easing);
    return;
  }

  const styles = config.styles || getTransitionStyles(type, duration, easing);
  const originalTransition = element.style.transition;
  const originalAnimation = element.style.animation;

  try {
    // Clear any existing animation for shake restart
    if (type === "shake") {
      element.style.animation = "none";
      void element.offsetHeight;
    }

    // Apply exit transition
    applyStyles(element, styles.exit);
    void element.offsetHeight;
    applyStyles(element, styles.exitActive);

    await wait(duration);

    // Update content
    await updateCallback();

    // Apply enter transition
    applyStyles(element, styles.enter);
    void element.offsetHeight;
    applyStyles(element, styles.enterActive);

    await wait(duration);

    // Restore original styles
    element.style.transition = originalTransition;
    element.style.animation = originalAnimation;
  } catch (error) {
    element.style.transition = originalTransition;
    element.style.animation = originalAnimation;
    throw error;
  }
};
