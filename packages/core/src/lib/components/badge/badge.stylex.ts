import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';

const styles = stylex.create({
	base: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacingVars['--spacing-1'],
		height: spacingVars['--spacing-5'],
		paddingBlock: 0,
		paddingInline: spacingVars['--spacing-2'],
		borderRadius: radiusVars['--radius-full'],
		fontFamily: 'inherit',
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		whiteSpace: 'nowrap',
		// A badge is one line by construction — fixed height, `nowrap` — so a
		// label wider than the space available has to go somewhere. Without these
		// it went *outside* its container: `nowrap` with nothing to clip it
		// neither wraps nor truncates, it just escapes, and lands on whatever sits
		// beside it. `minWidth: 0` matters as much as the max: as a flex item the
		// automatic minimum size would otherwise hold the badge at its full text
		// width and push the clamp back out again.
		maxWidth: '100%',
		minWidth: 0
	},
	// Never shorter than one line of its label: when the text grows (a larger
	// text size), the pill grows with the label instead of the label spilling
	// out of it. A minimum rather than a new height, so the theme's height
	// (`--spacing-5`, or a theme's own, such as Butter's 30px) holds at the
	// default size, where the line fits. Only with a label: a color-only badge
	// has no text to hold and keeps the component:Badge FR1 geometry at every
	// text size.
	grows: {
		minHeight: '1lh'
	},
	// The ellipsis goes on the label rather than the badge itself, because
	// `text-overflow` needs a block container and taking the root off
	// `inline-flex` to get one would cost the icon its centring. The label is a
	// flex item, so it needs its own `minWidth: 0` for the same reason as above.
	label: {
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		minWidth: 0
	}
});

/**
 * Semantic variants take a solid fill; the colour-named ones take a tinted
 * background with matching text, so a wall of them stays readable.
 */
const variants = stylex.create({
	// Semantic
	neutral: {
		backgroundColor: colorVars['--color-neutral'],
		color: colorVars['--color-text-primary']
	},
	info: {
		backgroundColor: colorVars['--color-info'],
		color: colorVars['--color-on-info'],
		// Forced colors replace status fills with Canvas; this boundary keeps the
		// fill's shape visible (architecture:theme-tokens INV11).
		outlineWidth: { default: null, '@media (forced-colors: active)': '1px' },
		outlineStyle: { default: null, '@media (forced-colors: active)': 'solid' },
		outlineColor: { default: null, '@media (forced-colors: active)': 'CanvasText' },
		outlineOffset: { default: null, '@media (forced-colors: active)': '-1px' }
	},
	success: {
		backgroundColor: colorVars['--color-success'],
		color: colorVars['--color-on-success'],
		// Forced colors replace status fills with Canvas; this boundary keeps the
		// fill's shape visible (architecture:theme-tokens INV11).
		outlineWidth: { default: null, '@media (forced-colors: active)': '1px' },
		outlineStyle: { default: null, '@media (forced-colors: active)': 'solid' },
		outlineColor: { default: null, '@media (forced-colors: active)': 'CanvasText' },
		outlineOffset: { default: null, '@media (forced-colors: active)': '-1px' }
	},
	warning: {
		backgroundColor: colorVars['--color-warning'],
		color: colorVars['--color-on-warning'],
		// Forced colors replace status fills with Canvas; this boundary keeps the
		// fill's shape visible (architecture:theme-tokens INV11).
		outlineWidth: { default: null, '@media (forced-colors: active)': '1px' },
		outlineStyle: { default: null, '@media (forced-colors: active)': 'solid' },
		outlineColor: { default: null, '@media (forced-colors: active)': 'CanvasText' },
		outlineOffset: { default: null, '@media (forced-colors: active)': '-1px' }
	},
	error: {
		backgroundColor: colorVars['--color-error'],
		color: colorVars['--color-on-error'],
		// Forced colors replace status fills with Canvas; this boundary keeps the
		// fill's shape visible (architecture:theme-tokens INV11).
		outlineWidth: { default: null, '@media (forced-colors: active)': '1px' },
		outlineStyle: { default: null, '@media (forced-colors: active)': 'solid' },
		outlineColor: { default: null, '@media (forced-colors: active)': 'CanvasText' },
		outlineOffset: { default: null, '@media (forced-colors: active)': '-1px' }
	},
	// Non-semantic
	blue: {
		backgroundColor: colorVars['--color-background-blue'],
		color: colorVars['--color-text-blue']
	},
	cyan: {
		backgroundColor: colorVars['--color-background-cyan'],
		color: colorVars['--color-text-cyan']
	},
	green: {
		backgroundColor: colorVars['--color-background-green'],
		color: colorVars['--color-text-green']
	},
	orange: {
		backgroundColor: colorVars['--color-background-orange'],
		color: colorVars['--color-text-orange']
	},
	pink: {
		backgroundColor: colorVars['--color-background-pink'],
		color: colorVars['--color-text-pink']
	},
	purple: {
		backgroundColor: colorVars['--color-background-purple'],
		color: colorVars['--color-text-purple']
	},
	red: {
		backgroundColor: colorVars['--color-background-red'],
		color: colorVars['--color-text-red']
	},
	teal: {
		backgroundColor: colorVars['--color-background-teal'],
		color: colorVars['--color-text-teal']
	},
	yellow: {
		backgroundColor: colorVars['--color-background-yellow'],
		color: colorVars['--color-text-yellow']
	}
});

/**
 * Extensible variant map for Badge.
 *
 * Theme packages add their own variants by augmenting this interface:
 *
 * @example
 * declare module '@astryx-sv/core' {
 *   interface BadgeVariantMap {
 *     premium: true;
 *   }
 * }
 */
export interface BadgeVariantMap {
	neutral: true;
	info: true;
	success: true;
	warning: true;
	error: true;
	blue: true;
	cyan: true;
	green: true;
	orange: true;
	pink: true;
	purple: true;
	red: true;
	teal: true;
	yellow: true;
}

/** Badge variant. Extensible via `BadgeVariantMap`. */
export type BadgeVariant = keyof BadgeVariantMap;

export function badgeAttrs(
	variant: BadgeVariant,
	hasLabel: boolean,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.base,
		hasLabel && styles.grows,
		variants[variant as keyof typeof variants],
		xstyle
	);
}

/** The label span, which ellipsises. */
export function badgeLabelAttrs(): SvelteStyleAttrs {
	return sx(styles.label);
}
