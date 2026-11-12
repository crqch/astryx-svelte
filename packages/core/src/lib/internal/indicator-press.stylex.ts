import * as stylex from '@stylexjs/stylex';

/**
 * Ported from Astryx's `internal/indicatorPress.stylex.ts`.
 *
 * Marks a first-party replacement indicator that paints its own press, for a
 * shape that CheckboxInput's rounded-square press layer would tint past, such
 * as a circle. CheckboxInput leaves that layer off over an indicator with this
 * marker.
 *
 * @internal Not public API: the touch press reaches the indicator through a
 * private property.
 *
 * Its class is path-derived, so it cannot match upstream's by name — keys that
 * resolve against it are compared marker-normalised by the class oracle, like
 * the other marker modules.
 */
export const indicatorPressScope: ReturnType<typeof stylex.defineMarker> = stylex.defineMarker();
