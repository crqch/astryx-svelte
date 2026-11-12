import * as stylex from '@stylexjs/stylex';
import { durationVars } from '../../styles/tokens.stylex.js';

/**
 * The one turning arc, ported from Astryx's `Spinner/spinnerRotor.ts`.
 *
 * Upstream shares it with Lab's indeterminate CircularProgress through
 * `@astryxdesign/core/internal/spinner-rotor`; this port has no Lab surface, so
 * the module is only Spinner's.
 */

/** The fraction of the ring the arc covers: 135deg. */
export const SPINNER_ARC_FRACTION = 0.375;

/**
 * Full turns in one iteration of the rotation.
 *
 * Chromium wakes the main thread at each iteration boundary while the
 * document listens for `animationiteration`. React listens for it on every
 * root. One iteration holds 100 turns, so the wake comes once in 100 turns.
 * Each turn is 360 degrees, so the ring looks the same.
 */
const TURNS_PER_ITERATION = 100;

/**
 * A `transform` animation runs on the compositor, so the ring keeps turning
 * while a script runs. A `stroke-dashoffset` animation would repaint the arc
 * on the main thread every frame, so it would stop while a script runs.
 */
const rotation = stylex.keyframes({
	'0%': { transform: 'rotate(0deg)' },
	'100%': { transform: `rotate(${360 * TURNS_PER_ITERATION}deg)` }
});

export const spinnerRotorStyles = stylex.create({
	turn: {
		// Mobile Safari keeps a re-timed animation off the main thread only on
		// an element with its own layer. So the rotor declares one before the
		// start time is set (see `pinRotorsToTimelineOrigin`).
		willChange: 'transform',
		// Reduced motion slows the turn but never stops it: a still ring reads
		// as broken. The ring's role and name still say that work is busy.
		animationDuration: {
			// The loop reads the duration before a theme's tempo scales it.
			default: `calc(var(--_astryx-pre-tempo-duration-slow-min, ${durationVars['--duration-slow-min']}) * ${TURNS_PER_ITERATION})`,
			'@media (prefers-reduced-motion: reduce)': `calc(3s * ${TURNS_PER_ITERATION})`
		},
		animationIterationCount: 'infinite',
		animationName: rotation,
		animationTimingFunction: 'linear'
	}
});
