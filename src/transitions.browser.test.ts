import { describe, expect, it } from "vitest";
import { morph } from "./index.js";

describe("fade cross-fade in a real browser", () => {
  // regression: the snapshot used viewport coordinates (getBoundingClientRect)
  // with position:absolute on <body>, so on a scrolled page the old content
  // faded out scrollY pixels away from the element it stands in for
  it("places the snapshot over the element on a scrolled page", async () => {
    const spacer = document.createElement("div");
    spacer.style.height = "3000px";
    const el = document.createElement("div");
    el.innerHTML = "<p>old</p>";
    document.body.append(spacer, el);
    el.scrollIntoView();
    expect(window.scrollY).toBeGreaterThan(0);

    const done = morph(el, "<p>new</p>", { transition: { type: "fade", duration: 40, target: "self" } });
    const snapshot = [...document.body.children].find(
      (node) => node !== el && node !== spacer && node.textContent === "old",
    ) as HTMLElement;
    const snapRect = snapshot.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    await done;

    expect(Math.abs(snapRect.top - elRect.top)).toBeLessThan(1);
    expect(Math.abs(snapRect.left - elRect.left)).toBeLessThan(1);
    spacer.remove();
    el.remove();
  });
});
