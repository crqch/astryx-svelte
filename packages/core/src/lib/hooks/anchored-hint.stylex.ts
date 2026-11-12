import * as stylex from '@stylexjs/stylex';
import {
	colorVars,
	radiusVars,
	shadowVars,
	spacingVars,
	typeScaleVars
} from '../styles/tokens.stylex.js';

/**
 * The anchored hint's styles, from Astryx's `hooks/anchoredHint.tsx`.
 *
 * A small surface in the top layer, below the start of the element it is
 * anchored to. It has the popover background, the element radius, the low
 * shadow and supporting text. A reorderable List renders its reorder mode's
 * hint with it, whose glyphs are buttons.
 *
 * The React half of upstream's module (`renderAnchoredHint`) is a `layer.render`
 * call; this port renders the hint in `list-reorder-mode-hint.svelte`, so only
 * the styles are shared here.
 */
const styles = stylex.create({
	hint: {
		// Top layer + anchor positioned
		position: 'fixed',
		inset: 'auto',
		margin: 0,
		borderWidth: 0,
		borderStyle: 'none',

		// Surface
		backgroundColor: colorVars['--color-background-popover'],
		borderRadius: radiusVars['--radius-element'],
		boxShadow: shadowVars['--shadow-low'],
		paddingBlockStart: spacingVars['--spacing-1'],
		paddingBlockEnd: spacingVars['--spacing-1'],
		paddingInlineStart: spacingVars['--spacing-2'],
		paddingInlineEnd: spacingVars['--spacing-2'],

		// Typography
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		color: colorVars['--color-text-secondary'],
		whiteSpace: 'nowrap',

		// Animation
		opacity: {
			default: 0,
			':popover-open': 1
		},
		transitionProperty: 'opacity, display, overlay',
		transitionDuration: '150ms',
		transitionBehavior: 'allow-discrete'
	},
	// A hint that only teaches floats above the content without taking its
	// pointer events.
	passive: {
		pointerEvents: 'none'
	},
	keys: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1']
	},
	label: {
		marginInlineStart: spacingVars['--spacing-1']
	}
});

/** The hint's row of key glyphs, and the label after it. */
export const anchoredHintStyles = {
	keys: styles.keys,
	label: styles.label,
	hint: styles.hint,
	passive: styles.passive
};
