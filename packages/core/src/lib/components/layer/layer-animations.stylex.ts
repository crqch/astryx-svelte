import * as stylex from '@stylexjs/stylex';
import { reducedMotionFadeConsts } from '../../motion/reduced-motion.stylex.js';
import { durationVars, easeVars, spacingVars } from '../../styles/tokens.stylex.js';

/**
 * Shared entry animations for layer-based components, ported from Astryx's
 * `Layer/layerAnimations.stylex.ts` at 0.7.16.
 *
 * Opt-in: a component passes one through `<Layer xstyle={…}>`, which is where
 * upstream passes it through `layer.render(…, {xstyle})`. Apply it to the
 * element that fills the layer (its surface), not to the layer: Chromium lays
 * an anchored layer out again on each frame that its own style animates.
 *
 * An anchored layer's entrance slides from, and scales about, the side the
 * layer lands on after any flip. The layer runtime writes that side
 * (`layerEntranceSide.ts`) as `--_astryx-layer-enter-x`/`-y`, the scale's
 * origin and the room to the trigger. The fallbacks below are the placement's
 * own side, for a layer nothing writes to.
 *
 * @example
 * ```svelte
 * <Layer {layer} {placement} xstyle={layerAnimations[placement]}>…</Layer>
 * ```
 */

const ENTER_X = '--_astryx-layer-enter-x';
const ENTER_Y = '--_astryx-layer-enter-y';
const ENTER_ORIGIN = '--_astryx-layer-enter-origin';
const ENTER_GAP = '--_astryx-layer-enter-gap';
// One step: the spacing token, or the room to the trigger when that is less.
const STEP = `min(${spacingVars['--spacing-2']}, var(${ENTER_GAP}, ${spacingVars['--spacing-2']}))`;

const enterBelow = stylex.keyframes({
	from: {
		opacity: 0,
		transform: `translate(calc(var(${ENTER_X}, 0) * ${STEP}), calc(var(${ENTER_Y}, -1) * ${STEP})) scale(0.95)`
	},
	to: { opacity: 1, transform: 'translate(0, 0) scale(1)' }
});

const enterAbove = stylex.keyframes({
	from: {
		opacity: 0,
		transform: `translate(calc(var(${ENTER_X}, 0) * ${STEP}), calc(var(${ENTER_Y}, 1) * ${STEP})) scale(0.95)`
	},
	to: { opacity: 1, transform: 'translate(0, 0) scale(1)' }
});

const enterEnd = stylex.keyframes({
	from: {
		opacity: 0,
		transform: `translate(calc(var(${ENTER_X}, -1) * ${STEP}), calc(var(${ENTER_Y}, 0) * ${STEP})) scale(0.95)`
	},
	to: { opacity: 1, transform: 'translate(0, 0) scale(1)' }
});

const enterStart = stylex.keyframes({
	from: {
		opacity: 0,
		transform: `translate(calc(var(${ENTER_X}, 1) * ${STEP}), calc(var(${ENTER_Y}, 0) * ${STEP})) scale(0.95)`
	},
	to: { opacity: 1, transform: 'translate(0, 0) scale(1)' }
});

// RTL: the horizontal fallback is a physical translate, so it mirrors under
// RTL. A layer on the inline-end or inline-start side then slides in from the
// physical side that follows the reading flow. Only the horizontal fallbacks
// mirror; the vertical ones are direction-neutral. The side the runtime writes
// is physical already.
const enterEndRtl = stylex.keyframes({
	from: {
		opacity: 0,
		transform: `translate(calc(var(${ENTER_X}, 1) * ${STEP}), calc(var(${ENTER_Y}, 0) * ${STEP})) scale(0.95)`
	},
	to: { opacity: 1, transform: 'translate(0, 0) scale(1)' }
});

const enterStartRtl = stylex.keyframes({
	from: {
		opacity: 0,
		transform: `translate(calc(var(${ENTER_X}, -1) * ${STEP}), calc(var(${ENTER_Y}, 0) * ${STEP})) scale(0.95)`
	},
	to: { opacity: 1, transform: 'translate(0, 0) scale(1)' }
});

// Reduce Motion under a finger: the same entrance without its travel. A touch
// presentation substitutes a cross-fade for motion, never a jump.
// The fade's curve rides in its first keyframe, so the published class type
// of `animationTimingFunction` stays the theme ease's.
const fadeIn = stylex.keyframes({
	from: { opacity: 0, animationTimingFunction: reducedMotionFadeConsts.easing },
	to: { opacity: 1 }
});

// No theme value lengthens the Reduce Motion fade, so its values are constants.
// The media keys stay literal: StyleX gives an imported at-rule key a later
// priority layer (see reducedMotionKeys).
const animationBase = {
	animationDuration: {
		default: durationVars['--duration-fast-max'],
		'@media (prefers-reduced-motion: reduce) and (pointer: coarse)':
			reducedMotionFadeConsts.duration
	},
	animationTimingFunction: easeVars['--ease-standard'],
	animationFillMode: 'backwards' as const,
	// The origin is a plain style, not a keyframe: a keyframe that animates it
	// would keep the entrance off the compositor.
	transformOrigin: `var(${ENTER_ORIGIN}, 50% 50%)`
};

/**
 * Keyed by `LayerPlacement` for lookup as `layerAnimations[placement]`.
 *
 * Under `prefers-reduced-motion: reduce` each entry drops its travel and
 * scale. Under a finger (the primary pointer is coarse) the layer fades in,
 * opacity only, in 200 ms on easeInOut: on a touch screen Reduce Motion
 * replaces motion with a cross-fade rather than a jump; under any other
 * pointer it appears at once.
 */
export const layerAnimations = stylex.create({
	below: {
		animationName: {
			default: enterBelow,
			'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': 'none',
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': fadeIn
		},
		...animationBase
	},
	above: {
		animationName: {
			default: enterAbove,
			'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': 'none',
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': fadeIn
		},
		...animationBase
	},
	end: {
		animationName: {
			default: enterEnd,
			':is([dir="rtl"] *)': enterEndRtl,
			'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': 'none',
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': fadeIn
		},
		...animationBase
	},
	start: {
		animationName: {
			default: enterStart,
			':is([dir="rtl"] *)': enterStartRtl,
			'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': 'none',
			'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': fadeIn
		},
		...animationBase
	}
});
