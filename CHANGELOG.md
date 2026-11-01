# Changelog

Each release of the npm package `defuss-morph`, newest first. A release bumps the version here, in `package.json`, in the plugin manifests and the skill, and on the website; `scripts/lib/version.test.ts` checks that they agree.

## 0.3.0 (2026-11-01)

### Added

- `reactive(config, target)` re-renders an element from a store on every change and returns a function that stops it; an `AbortSignal` stops it too. `<Reactive>` does the same as a component, and `installReactive(df$)` adds `df$(selector).reactive()` to defuss-query.
- `createRef()` for a reference to a rendered element, with optional state a parent can read and reset.
- A JSX runtime: `defuss-morph/jsx-runtime` (`jsx`, `jsxs`, `jsxDEV`, `Fragment`) and `h()` for JSX without a build step.
- An Agent Skill for Claude Code and Codex in `skills/defuss-morph/`, shipped with the package.

### Changed

- A keyed reorder moves only the nodes that are out of order: the longest run already in order stays where it is. Swapping rows 2 and 999 of 1,000 moves 2 rows instead of 997; removing one row moves none instead of 500.
- A matched node moves with `moveBefore()` where the browser has it, which keeps focus, the caret and other live state. Elsewhere `insertBefore()` moves it and morph puts focus and the text selection back.
- Faster HTML strings and small re-renders: one parsing document per `DOMParser` instead of one per call, a cheaper conversion of parsed markup, and children that line up one to one with the existing ones are patched in order without the matching tables.

### Fixed

- A node whose `id` another, matched node also carried was neither reused nor removed, and stayed in the DOM.
- camelCase SVG elements in HTML strings (`linearGradient`, `clipPath`, `foreignObject`) were created with lowercased names, as unknown elements, so gradients and clip paths did not render.
- A `<template>` in an HTML string arrived empty, and morph read and patched a template's `childNodes` instead of its `.content`.
- HTML fragments lost table rows and cells (`<tr>`, `<td>`) and a leading comment; fragments now parse as `<template>` content.
- `onUnmount` handlers now receive the element, as their type declares.

## 0.2.0 (2026-10-04)

## 0.1.1 (2026-09-14)

## 0.1.0 (2026-09-10)

No changelog was kept before 0.3.0; the dates are those of the npm releases.
