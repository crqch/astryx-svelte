# SnapPaging: scope

`SnapPaging` is the last component upstream Astryx 0.7.13 has and this port does
not. This note records what porting it actually entails, so the decision to start
it — or to keep deferring it — is made against the real dependency graph rather
than a file count.

## Public surface

`useSnapPaging(options?: SnapPagingOptions): SnapPaging` is a behavior hook, not
a component. It has no styles, no `themeProps` target and no theme surface.

- `SnapPagingOptions { readonly pages?: 'view' | 'item' }` (default `'view'`)
- `SnapPaging` is an opaque branded value (`{ '@astryxdesign/core/snap-paging/v1'?: never }`)
- `Carousel` is its only consumer: `hasSnap?: boolean | SnapPaging`, plus
  `attachSnapPaging` / `moveSnapPaging` / `moveHeldSnapPaging`.

Upstream tests: `SnapPaging/SnapPaging.test.tsx` (23 declarations) plus two
Playwright interaction specs (33 + 8).

## Dependency closure

Walking imports from `SnapPaging/SnapPaging.ts` and `snapPagingValue.ts`
(excluding tests) yields **62 files / 24,106 lines**. The main groups:

| Group                                                                                                                                                                        | Files |       Lines (approx) |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | -------------------: |
| `gestures/` (GestureHost, GestureArena, recognizers, PressTracker, wheelSegmenter, selectionLock, …)                                                                         |    17 |              ~11,700 |
| `motion/` (animator, spring, paging, presentation, projection, resolve*, uikit/*, …)                                                                                         |    19 |               ~9,000 |
| `hooks/usePager.ts`                                                                                                                                                          |     1 |                1,547 |
| `Layer/inputHold.ts`                                                                                                                                                         |     1 | 918 (already ported) |
| `utils/` (inputStream, selectionLock, clickGuard, scrollView, sharedMutationObserver, sharedResizeObserver, sharedRealm, flatTree, nodeType, coarsePointer, touchQueries, …) |    12 |               ~3,000 |
| `SnapPaging/` itself                                                                                                                                                         |     1 |      668 + 287 value |

`usePager` alone pulls in the same gesture and motion closure: **58 files /
22,696 lines**. `motion/animator.ts` is 5,051 lines; `GestureHost.ts` is 4,294.
This is why `SnapPaging` cannot be landed as an isolated component port.

Already available in this port (useful foundations, none of them the pager):

- `internal/shared-resize-observer.ts` (the 0.7.13 API and tests)
- `utils/input-stream.ts`, `utils/flat-tree.ts`, `utils/node-type.ts`,
  `utils/coarse-pointer.ts`, `utils/touch-queries.ts`, `utils/shared-realm.ts`
- `components/layer/input-hold.ts`, `hold-entrance-input.ts`
- `hooks/is-rtl-element.ts`
- `components/carousel` — but its public API is data-driven (`items` + `item`
  snippet), not React children, so upstream's snap integration does not
  transcribe; it has to be re-expressed against this component's own model.

## Phased plan

1. **Motion core, no gestures.** Port `motion/spring.ts`, `bezier.ts`,
   `paging.ts`, `projection.ts`, `rubberBand.ts`, `resolveSnapPoint.ts`,
   `resolveMotion.ts`, `reducedMotionPlan.ts`, `roles.ts`, `roleValue.ts`,
   `themeTempo.ts`, `frameBlock.ts`, `presentation.ts` and `uikit/*` with their
   unit suites. This is the numerically testable half and can be verified
   headlessly (no DOM beyond a frame clock).
2. **Gesture recognizers.** Port `gestures/` in dependency order: geometry,
   types, recognizerInternals, GestureRecognizer, PressTracker,
   Pan/Tap/LongPress/ScreenEdgePan, VelocityTracker, wheelSegmenter,
   GestureArena, nativeScroll, touchAction(+rule), selectionLock, hostRegistry,
   GestureHost. Port their unit suites and the pointer/gesture Playwright proofs
   where the local harness can run them.
3. **Pager.** Port `hooks/usePager.ts` on top of (1) and (2), then
   `SnapPaging/snapPagingValue.ts` and `SnapPaging/SnapPaging.ts`.
4. **Carousel integration.** Re-express `hasSnap`/snap paging against the local
   Carousel's data model, and port `SnapPaging.test.tsx` (23) plus the two
   interaction specs as the acceptance suite.

## Where the port stands

- **Step 1 (motion core):** landed. `motion/*`, the full `motion/uikit` table,
  `animator`, `coast`, `progress`, `reduced-motion-plan`, `theme-timing` and
  their suites are green; the animator's esbuild bundle case is the one
  unported declaration.
- **Step 2 (gestures):** landed. Recognizers, `GestureArena`, `GestureHost`,
  `PressTracker`, `VelocityTracker`, `wheelSegmenter`, `touchAction(+Rule)`,
  `selectionLock`, `nativeScroll`, `pageHold` and their unit suites are green.
  `recognizerBundle` (3) and `VelocityTracker.harness` (3) inspect esbuild or
  the Playwright harness and stay unported; `GestureHost.bundle` (5) is the
  same esbuild prerequisite.
- **Step 3 (pager):** `createPager` (`lib/pager.ts`), `motion/paging.ts`,
  `snapPagingValue.ts` and a Svelte `useSnapPaging` are ported. The value's stop
  arithmetic, held-row geometry and attach/move relay are covered (11 cases).
- **Step 4 (Carousel):** `hasSnap` now accepts `true | SnapPaging`, attaches
  the paging to the scroller, and routes edge presses, wheel and `scrollTo`
  through `moveSnapPaging`/`moveHeldSnapPaging`. The Carousel-facing half of
  `SnapPaging.test.tsx` (12 cases: value stability, single attach, held edges
  and focus hand-back) still needs its own browser suite.

The component surface is no longer missing a directory: `snap-paging` exists
and is exported from the package root.
