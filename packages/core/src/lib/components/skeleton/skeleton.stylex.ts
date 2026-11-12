import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, durationVars, radiusVars } from '../../styles/tokens.stylex.js';

/**
 * Delay before the pulse starts, so content that loads quickly never flashes an
 * animation.
 */
const DELAY_TIME = 1000;

/** Stagger between sequential skeletons, which reads as a wave. */
const STAGGER_TIME = 100;

/**
 * The pulse climbs from 0.25 to 0.925 opacity in ten equal steps, then plays
 * back down (`alternate`). The steps are written out as holds joined by
 * 0.01% ramps, with a linear timing function, rather than produced by a
 * `steps()` timing function: WebKit never runs a `steps()` animation on the
 * compositor, so Safari would repaint the pulse on the main thread and freeze
 * it whenever a script runs. These keyframes give the same values at the same
 * times, which every engine can animate off the main thread.
 */
const skeletonFade = stylex.keyframes({
	'0%': { opacity: 0.25 },
	'9.99%': { opacity: 0.25 },
	'10%': { opacity: 0.325 },
	'19.99%': { opacity: 0.325 },
	'20%': { opacity: 0.4 },
	'29.99%': { opacity: 0.4 },
	'30%': { opacity: 0.475 },
	'39.99%': { opacity: 0.475 },
	'40%': { opacity: 0.55 },
	'49.99%': { opacity: 0.55 },
	'50%': { opacity: 0.625 },
	'59.99%': { opacity: 0.625 },
	'60%': { opacity: 0.7 },
	'69.99%': { opacity: 0.7 },
	'70%': { opacity: 0.775 },
	'79.99%': { opacity: 0.775 },
	'80%': { opacity: 0.85 },
	'89.99%': { opacity: 0.85 },
	'90%': { opacity: 0.925 },
	'100%': { opacity: 0.925 }
});

const styles = stylex.create({
	root: {
		backgroundColor: {
			default: colorVars['--color-skeleton'],
			'@media (prefers-contrast: more)': `color-mix(in srgb, ${colorVars['--color-skeleton']}, ${colorVars['--color-text-primary']} 30%)`,
			// Forced colors (Windows High Contrast) strips painted backgrounds,
			// which would make the placeholder invisible. GrayText is a system
			// color, so it survives forcing and keeps the placeholder visible
			// (WCAG 1.4.11). Listed after prefers-contrast so it wins when both
			// media features are active.
			'@media (forced-colors: active)': 'GrayText'
		},
		opacity: {
			default: 0.25,
			// The resting 0.25 opacity would render GrayText nearly invisible on
			// Canvas; full opacity keeps the static placeholder perceivable (the
			// fade animation still pulses when motion is allowed).
			'@media (forced-colors: active)': 1
		}
	},
	animate: {
		animationDirection: 'alternate',
		// A busy loop reads the duration before a theme's tempo scales it.
		animationDuration: `var(--_astryx-pre-tempo-duration-medium-max, ${durationVars['--duration-medium-max']})`,
		animationIterationCount: 'infinite',
		// No pulse under reduced motion; the static placeholder still reads as
		// loading.
		animationName: {
			default: skeletonFade,
			'@media (prefers-reduced-motion: reduce)': 'none'
		},
		// Linear between the keyframes' holds; see skeletonFade.
		animationTimingFunction: 'linear'
	}
});

const radiusStyles = stylex.create({
	none: {
		borderRadius: 0
	},
	0: {
		borderRadius: radiusVars['--radius-none']
	},
	1: {
		borderRadius: radiusVars['--radius-inner']
	},
	2: {
		borderRadius: radiusVars['--radius-element']
	},
	3: {
		borderRadius: radiusVars['--radius-container']
	},
	4: {
		borderRadius: radiusVars['--radius-container']
	},
	rounded: {
		borderRadius: radiusVars['--radius-full']
	}
});

const dynamicStyles = stylex.create({
	animationDelay: (index: number) => ({
		animationDelay: `${DELAY_TIME + STAGGER_TIME * index}ms`
	}),
	dimensions: (width: number | string, height: number | string) => ({
		width: typeof width === 'number' ? `${width}px` : width,
		height: typeof height === 'number' ? `${height}px` : height
	})
});

/** Corner radius, on the radius token scale. */
export type SkeletonRadius = keyof typeof radiusStyles;

export interface SkeletonAttrsOptions {
	width: number | string;
	height: number | string;
	radius: SkeletonRadius;
	index: number;
}

export function skeletonAttrs(
	{ width, height, radius, index }: SkeletonAttrsOptions,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.root,
		styles.animate,
		radiusStyles[radius],
		dynamicStyles.dimensions(width, height),
		dynamicStyles.animationDelay(index),
		xstyle
	);
}
