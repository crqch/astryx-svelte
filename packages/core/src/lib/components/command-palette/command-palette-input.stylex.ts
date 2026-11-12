import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';
import {
	colorVars,
	typeScaleVars,
	spacingVars,
	typographyVars
} from '../../styles/tokens.stylex.js';

/** Ported from Astryx's `CommandPalette/CommandPaletteInput.tsx` styles. */
const styles = stylex.create({
	wrapper: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-4'],
		paddingBlock: spacingVars['--spacing-3'],
		flexShrink: 0
	},
	// The icon span needs explicit flex centering to avoid line-height offset
	icon: {
		display: 'flex',
		alignItems: 'center',
		flexShrink: 0,
		color: colorVars['--color-text-secondary']
	},
	// Groups spinner + endContent on the right with a consistent gap
	end: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		flexShrink: 0
	},
	// Delay spinner appearance to avoid flickering on near-instant searches.
	// Uses @starting-style + transition-delay so the spinner only appears
	// if the search is still pending after 150ms.
	spinner: {
		opacity: 1,
		transitionProperty: 'opacity',
		transitionDuration: '1ms',
		transitionDelay: '150ms',
		'@starting-style': {
			opacity: 0
		}
	},
	input: {
		flex: 1,
		minWidth: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		color: colorVars['--color-text-primary'],
		fontFamily: typographyVars['--font-family-body'],
		// The 16px floor is iOS-only: iOS Safari zooms the page when a focused
		// control sits under 16px, and only iOS WebKit implements
		// -webkit-touch-callout to key the coarse-pointer floor to it.
		fontSize: {
			default: typeScaleVars['--text-body-size'],
			'@media (pointer: coarse)': {
				'@supports (-webkit-touch-callout: none)': `max(1rem, ${typeScaleVars['--text-body-size']})`
			}
		},
		lineHeight: typeScaleVars['--text-body-leading'],
		padding: 0,
		'::placeholder': {
			color: colorVars['--color-text-secondary']
		}
	}
});

/** The row holding the icon, input and trailing content. */
export function commandPaletteInputWrapperAttrs(xstyle: StyleArg): SvelteStyleAttrs {
	return sx(styles.wrapper, xstyle);
}

/** The leading search-icon span. */
export function commandPaletteInputIconAttrs(): SvelteStyleAttrs {
	return sx(styles.icon);
}

/** The trailing cluster holding the spinner and `endContent`. */
export function commandPaletteInputEndAttrs(): SvelteStyleAttrs {
	return sx(styles.end);
}

/** The busy spinner, which fades in only after 150ms. */
export function commandPaletteInputSpinnerAttrs(): SvelteStyleAttrs {
	return sx(styles.icon, styles.spinner);
}

/**
 * The text input itself. A text-entry control matches `:focus-visible` after
 * pointer focus in Chromium too, so the shared ring is narrowed to focus
 * acquired through keyboard navigation; a click or pointer-opened palette
 * stays unringed.
 */
export function commandPaletteInputAttrs(isKeyboardFocus: boolean): SvelteStyleAttrs {
	return isKeyboardFocus
		? focusOutlineProps.focusVisible(styles.input)
		: focusOutlineProps.suppressed(styles.input);
}
