import * as stylex from '@stylexjs/stylex';

/**
 * Ported from Astryx's `Layout/layoutEdges.stylex.ts`.
 *
 * A header or footer carries the marker on its own element, so Layout's middle
 * row can tell whether a divider-less header precedes it or a divider-less
 * footer follows it with sibling relations alone. The alternative — `:has()` on
 * the layout followed by `*` — makes engines restyle the whole layout on any
 * change inside it.
 */
export const layoutHeaderMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();
export const layoutFooterMarker: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();
