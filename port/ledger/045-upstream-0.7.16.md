---
seq: 045
title: Batch 45 — upstream 0.7.16, the Lightbox caption band and the style re-baseline
upstream: 0.7.16
date: 2026-11-14
units: [Lightbox, zoomStage, Button, CheckboxInput, RadioListItem, Layer, Tokenizer, BottomSheet, Carousel, Token, InputGroupText, ChatComposerInput]
upstream-prs: []
---

## Scope

The pin moves from `0.7.13` to `0.7.16`. The release's centre is `Lightbox`'s redesign: every item
is a track page with a two-line caption band under the photo, the caption opens over the photo, and
the zoom stage becomes the viewer's gesture surface for every pointer. The batch ports that
subsystem (`zoom-stage.ts`, `use-zoom-core.svelte.ts`, `use-zoom-stage.svelte.ts`) and the styles it
needs, then re-baselines both fidelity oracles against the 0.7.16 tarball.

The rest of the release is worked by what the oracles named: the forced-colors surface edges
(Button, Dialog, Popover, ContextMenu, DropdownMenu sub-menu), the touch press paint shared by
CheckboxInput and RadioListItem, the layer entrance side variables, the ContainerReveal pointer
query, the Carousel pill's focus-ring inset, the Token and InputGroupText bidi isolation, the
ChatComposerInput editable floor, and BottomSheet's scrim handoff properties. `Tokenizer`'s grouped
presentation lands as styles only; wiring it into the component is a follow-up.

Deliberately not in this batch, and left visible in `status.md`: the release's test delta and the
docs props surface that followed the new `.doc.mjs` files. Both are their own front, and the case
table is where the shortfall is measured.

## Lightbox

The 0.7.16 rewrite:

- **Every item is a page.** `mediaArray` always renders through the track; a single photo is a
  one-page track. The track's two rows (`minmax(0, 1fr) auto`) are shared by the pages through
  subgrid, so a photo centres on the same box with or without a caption and paging never resizes
  it.
- **The caption band.** Two caption lines tall whatever the caption, on a translucent backing
  (`color-mix(on-light 90%, transparent)`), with a `more`/`less` link that opens the full caption
  over the photo's bottom. The band's height and the toggle's place are measured from the laid-out
  caption; an open caption scrolls past 60 % of the viewport.
- **The zoom stage.** `zoom-stage.ts` is upstream's pure geometry, ported whole. `useZoomCore`
  writes the photo's `translate`/`scale` through the compositor animator, settles every zoom on
  `springs.settle`, and reports `isAtEdge` to the pager. `useZoomStage` adds the pinch, pan,
  double-tap, tap, touch-down catch and drag-to-dismiss recognizers on the port's gesture host.
- **The rest of the 0.7.16 behavior**: rounded and NaN indices, `0` to reset zoom, RTL-aware gallery
  arrows, the backdrop's `isClickOutsideMedia`, the paging focus handoff, the video pause/autoplay
  sweep, `MediaTheme mode="dark"` around the viewer, and the caption's `aria-describedby`.
- `captionMore`/`captionLess` join the English catalog.
- `Lightbox/zoomStage.test.ts` is ported as `lightbox-zoom-stage.test.ts`: 38 cases over the
  overshoot, maximum zoom, both double taps, resting places, the rubber band, a resize, Photos'
  drag-to-dismiss and the keyboard's zoom. One case read upstream's component spec file, which this
  repo does not vendor; it is restated against the motion table's two measured springs.

One port substitution: upstream's caption is a `<Text type="body" maxLines={2}>`; a Svelte
component instance has no DOM node to measure, so this port renders a plain element with the same
type (`lightbox.stylex.ts`'s `captionText`) and attaches the now-public `useTruncation` hook to it.
The measurement delivery that upstream defers to a microtask and `flushSync` runs from a Svelte
effect and `tick`.

## Style re-baseline

- **Button**: the solid variants get upstream's `forcedColorsEdge`/`forcedColorsEdgeColor` groups;
  `variants.destructive` keeps only its edge colour and ring. A disabled `submit`/`reset` renders
  `type="button"` until hydration (`use-is-hydrating.svelte.ts`).
- **CheckboxInput / RadioListItem**: the press paint moves to the shared `indicatorPressPaintStyles`
  (`handDown`, `activeFill`, `image`) and `rowPressPaintStyles.radioRow`; the indicators no longer
  carry their own paint branches.
- **Layer**: `layerAnimations` reads `--_astryx-layer-enter-x`/`-y`/`-origin`/`-gap`, with the
  placement's side as each fallback, and sets `transform-origin` as a plain property.
- **ContainerReveal**: `any-pointer: coarse` becomes `pointer: coarse`.
- **Carousel**: the edge pills inset by the focus ring (`margin-inline-*`) instead of translating.
- **Token / InputGroupText**: `unicode-bidi: isolate`; Token also puts `dir="ltr"` on its label when
  the text holds no right-to-left letter (`i18n/first-strong-direction.ts`).
- **ChatComposerInput**: the editable keeps a one-line minimum height.
- **BottomSheet**: `scrimClosing` reads `--_sheet-scrim-easing`; the panel ends the scrim vars'
  inheritance.
- **Tokenizer**: the grouped strip's style keys (`inGroup*`, `trackFade*`) and their builders.

## Oracle bookkeeping

- Class oracle: `75 mismatches` at the bump → `0`. The Lightbox case is rebuilt for the 0.7.16
  call sites: the image wrapper, track, caption band, caption box, caption body and flow are inline;
  the caption, counter, page and page-media styles are objects again. The Tokenizer case gains the
  grouped content's two folded literals.
- CSS oracle: `116 mismatches` → `astryx.css matches upstream.` Forced-colors edges, the press
  paint, the layer entrance keyframes, `pointer` in ContainerReveal, and the sheet scrim properties
  closed the list.
- Five self-retiring skips remain, unchanged: the Lightbox layer-animation const hashes,
  DateTimeInput's native row, and the layer keyframes.

## What the audits caught

Not run to completion in this batch. The two fidelity oracles, the server suite and the seven theme
suites are green. The client suite and the docs surface check are run separately; the release's test
delta is not ported here and stays visible in `status.md`.

## Rules promoted

Nothing yet. The batch is in progress; the closing audits decide what moves into `CLAUDE.md` or
the agents.

## Debts opened

- `Tokenizer`'s grouped presentation ships styles only; the single-line strip inside `InputGroup`
  is not wired.
- `BottomSheet`'s scrim fade protocol (`writeScrimFade`, the drag's easing handoff) ships the
  properties, not the writer.
- `Layer`'s `layerEntranceSide` runtime writer ships the variables' readers, not the writer; the
  placement fallbacks play the entrance.
- `InputGroupText` cannot inspect a Svelte snippet's text, so it keeps `unicode-bidi: isolate`
  without the `dir="ltr"` inner span.
- `Lightbox`'s caption is measured on a plain element rather than `<Text>`; the caption toggle has
  no separate press tracker.
