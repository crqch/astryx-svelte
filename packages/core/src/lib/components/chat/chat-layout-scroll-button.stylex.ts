import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	shadowVars,
	sizeVars,
	spacingVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from the `styles` block in Astryx's `Chat/ChatLayoutScrollButton.tsx`.
 *
 * `button` redefines `--radius-element` *as a property* rather than reading it
 * — upstream's `[radiusVars['--radius-element'] as string]: radiusVars['--radius-full']`
 * — so `Button`'s own compiled radius resolves to the full pill inside this
 * container without overriding the declaration itself. The cast is upstream's
 * and is required: a computed key must be a string.
 */
const styles = stylex.create({
	wrapper: {
		display: 'flex',
		justifyContent: 'center',
		paddingBlockEnd: spacingVars['--spacing-3']
	},
	container: {
		pointerEvents: 'auto',
		contain: 'layout style',
		overflow: 'hidden',
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-background-popover'],
		boxShadow: shadowVars['--shadow-med'],
		// The pill clips its own content, so it must track the height of the
		// md Button it wraps. A literal would clip that Button under any theme
		// that retunes the element scale.
		height: sizeVars['--size-element-md'],
		// `visibility` rides the same transition so the fade-out still plays:
		// it flips to `visible` immediately on the way in and only at the end
		// of the duration on the way out.
		transitionProperty: 'opacity, transform, max-width, visibility',
		transitionTimingFunction: easeVars['--ease-standard'],
		transitionDuration: {
			default: durationVars['--duration-fast-max'],
			'@media (prefers-reduced-motion: reduce)': '0s'
		}
	},
	hidden: {
		opacity: 0,
		pointerEvents: 'none',
		// The hidden pill paints nothing, so focus landing on it would have no
		// visible indicator (WCAG 2.2 SC 2.4.7). `visibility` removes it from
		// sequential navigation after the fade; `inert` immediately prevents new
		// focus and makes an already-focused descendant relinquish focus.
		visibility: 'hidden',
		maxWidth: sizeVars['--size-element-md']
	},
	visible: {
		opacity: 1,
		pointerEvents: 'auto',
		visibility: 'visible'
	},
	collapsed: {
		maxWidth: sizeVars['--size-element-md']
	},
	expanded: {
		maxWidth: '200px'
	},
	button: {
		[radiusVars['--radius-element'] as string]: radiusVars['--radius-full'],
		whiteSpace: 'nowrap',
		paddingInline: spacingVars['--spacing-2']
	},
	// When a label is shown, the icon sits on the leading edge and the text on
	// the trailing edge. Symmetric padding leaves the text cramped against the
	// pill's rounded edge, so give the trailing side extra breathing room.
	buttonWithLabel: {
		paddingInlineEnd: spacingVars['--spacing-3']
	}
});

export function scrollButtonWrapperAttrs(xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(styles.wrapper, xstyle);
}

export function scrollButtonContainerAttrs(
	isVisible: boolean,
	hasLabel: boolean
): SvelteStyleAttrs {
	return sx(
		styles.container,
		isVisible ? styles.visible : styles.hidden,
		hasLabel ? styles.expanded : styles.collapsed
	);
}

export function scrollButtonStyle(hasLabel: boolean): StyleArg[] {
	return [styles.button, hasLabel ? styles.buttonWithLabel : null];
}
