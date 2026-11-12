import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusVars } from '../../styles/tokens.stylex.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';
import { interactionOverlayStyles } from '../../utils/interaction-overlay.stylex.js';
import type { TextColor } from '../text/text.stylex.js';
import {
	colorVars,
	durationVars,
	easeVars,
	spacingVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `Link/Link.tsx`.
 *
 * The link's own chrome — inline-flex layout, the hover underline, the
 * focus-visible ring — kept separate from `Text`, which owns the typography.
 * `buttonReset` strips the native `<button>` look on the button-fallback branch
 * only; `linkColorStyles` is the per-colour text/hover pair.
 */

const styles = stylex.create({
	base: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-0-5'],
		fontFamily: 'inherit',
		fontSize: 'inherit',
		lineHeight: 'inherit',
		fontWeight: 'inherit',
		textDecoration: {
			default: 'none',
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': 'underline'
			}
		},
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		transitionProperty: 'color, text-decoration',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	buttonReset: {
		backgroundColor: 'transparent',
		borderStyle: 'none',
		padding: 0,
		// Browsers centre a button's text; a wrapped label lines up as an
		// anchor's does.
		textAlign: 'inherit',
		pointerEvents: 'auto',
		position: 'relative'
	},
	// A truncating label needs a box that stops at its container: an
	// inline-flex root otherwise grows to its whole text, so its Text never
	// overflows and draws no ellipsis (`component:Link` FR6, `component:Text`
	// FR4).
	truncating: {
		maxWidth: '100%',
		minWidth: 0
	},
	// Inside a clamped Text the root joins the text's line boxes, so the
	// clamp can cut through the link. An inline-flex box is atomic: a clamp
	// cannot truncate it. The clamp also clips at the line edges, so the ring
	// sits inside each line box.
	inClampedText: {
		display: 'inline',
		outlineOffset: `calc(-1 * ${focusVars['--focus-outline-width']})`
	},
	externalIconInClampedText: {
		marginInlineStart: spacingVars['--spacing-0-5'],
		verticalAlign: 'middle'
	},
	hasUnderline: {
		textDecoration: 'underline'
	},
	disabled: {
		cursor: 'default',
		opacity: 0.5,
		pointerEvents: 'none'
	},
	standalone: {
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading']
	}
});

const linkColorStyles = stylex.create({
	primary: {
		color: {
			default: colorVars['--color-text-primary'],
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': `color-mix(in srgb, ${colorVars['--color-text-primary']}, ${colorVars['--color-tint-hover']} 15%)`
			}
		}
	},
	secondary: {
		color: {
			default: colorVars['--color-text-secondary'],
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': `color-mix(in srgb, ${colorVars['--color-text-secondary']}, ${colorVars['--color-tint-hover']} 15%)`
			}
		}
	},
	disabled: {
		color: colorVars['--color-text-disabled']
	},
	placeholder: {
		color: colorVars['--color-text-secondary']
	},
	accent: {
		color: {
			default: colorVars['--color-text-accent'],
			':hover:where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': `color-mix(in srgb, ${colorVars['--color-text-accent']}, ${colorVars['--color-tint-hover']} 15%)`
			}
		}
	},
	inherit: {
		color: 'inherit'
	}
});

/** Options that pick which of the style groups apply to a given branch. */
export interface LinkStyleOptions {
	/** The button-fallback branch, which adds `buttonReset`. */
	isButton: boolean;
	hasUnderline: boolean;
	isStandalone: boolean;
	/** Adds the disabled dim. Always true on the disabled-anchor branch. */
	isDisabled: boolean;
	/** A clamp on the inner Text needs the root to stop at its container. */
	isTruncating: boolean;
	/** The root joins an enclosing clamped Text's line boxes. */
	isInClampedText: boolean;
}

/**
 * The link root, for whichever of the three branches (`<button>`, disabled
 * `<a>`, or the polymorphic component) is chosen. The relative order matches
 * upstream's `stylex.props` in each branch — `buttonReset` and `disabled` simply
 * drop out where that branch omits them.
 */
export function linkAttrs(
	color: TextColor,
	{
		isButton,
		hasUnderline,
		isStandalone,
		isDisabled,
		isTruncating,
		isInClampedText
	}: LinkStyleOptions,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return focusOutlineProps.focusVisible(
		styles.base,
		isButton && styles.buttonReset,
		!isButton && isInClampedText && styles.inClampedText,
		linkColorStyles[color],
		// The system's pressed overlay behind the text; the hover stays the
		// colour change above, so a press is the one background it paints.
		isButton && !isDisabled && interactionOverlayStyles.pressedBackgroundColor,
		hasUnderline && styles.hasUnderline,
		isStandalone && styles.standalone,
		isDisabled && styles.disabled,
		isTruncating && styles.truncating,
		xstyle
	);
}

/** The external-link glyph inside an enclosing clamped Text. */
export function linkExternalIconAttrs(isInClampedText: boolean): SvelteStyleAttrs {
	return sx(isInClampedText && styles.externalIconInClampedText);
}
