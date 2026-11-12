import * as stylex from '@stylexjs/stylex';

/**
 * Scoped marker for Switch ancestor selectors, ported from Astryx's
 * `switch.markers.stylex.ts`.
 *
 * The track's focus outline and hover tints are pure CSS: they key off
 * `when.ancestor(':has(:focus-visible)', switchScope)` and
 * `when.ancestor(':hover', switchScope)`, which resolve against this marker on
 * the switch *row*. Scoping to the marker rather than a bare `:hover`/`:focus`
 * is what stops a parent container's hover or focus-within from bleeding onto
 * the control. The row drops the marker while disabled, so a disabled switch
 * takes neither tint nor outline.
 *
 * A marker lives in its own module because `defineMarker()`'s class is derived
 * from the module's path — the same split `overlay.markers.stylex.ts` uses.
 */
export const switchScope: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();

/**
 * Marks the switch's own focusable input, the track's preceding sibling, so
 * the track's focus ring follows that input's `:focus-visible` alone. Unlike
 * `switchScope`, it stays on while disabled (a focusable-disabled switch
 * still shows the ring).
 */
export const switchFocusInput: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();
