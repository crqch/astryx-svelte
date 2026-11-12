import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';

/**
 * Ported from the `styles` block in Astryx's `Chat/ChatComposerInput.tsx`.
 *
 * `LINE_HEIGHT_PX` is exported because the component multiplies it by `maxRows`
 * for the editable's inline `max-height` — a per-instance measurement with no
 * class worth minting, exactly as upstream computes it.
 *
 * The `@media (pointer: coarse)` floor of `1rem` is upstream's mobile-zoom
 * guard: iOS Safari zooms into any focused editable whose font is under 16px.
 */
export const LINE_HEIGHT_PX = 22;

const styles = stylex.create({
	root: {
		position: 'relative',
		display: 'flex',
		flexDirection: 'column',
		minHeight: `${LINE_HEIGHT_PX}px`
	},
	editable: {
		outline: 'none',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-word',
		overflowY: 'auto',
		// The 16px floor is iOS-only: iOS Safari zooms the page when a focused
		// control sits under 16px, and only iOS WebKit implements
		// -webkit-touch-callout to key the coarse-pointer floor to it.
		fontSize: {
			default: typeScaleVars['--text-body-size'],
			'@media (pointer: coarse)': {
				'@supports (-webkit-touch-callout: none)': `max(1rem, ${typeScaleVars['--text-body-size']})`
			}
		},
		lineHeight: `${LINE_HEIGHT_PX}px`,
		fontFamily: typographyVars['--font-family-body'],
		color: colorVars['--color-text-primary'],
		caretColor: colorVars['--color-accent'],
		paddingInline: spacingVars['--spacing-1']
	},
	placeholder: {
		position: 'absolute',
		top: 0,
		insetInlineStart: 0,
		insetInlineEnd: 0,
		pointerEvents: 'none',
		color: colorVars['--color-text-secondary'],
		// Same iOS-only floor as the editable region it stands in for.
		fontSize: {
			default: typeScaleVars['--text-body-size'],
			'@media (pointer: coarse)': {
				'@supports (-webkit-touch-callout: none)': `max(1rem, ${typeScaleVars['--text-body-size']})`
			}
		},
		lineHeight: `${LINE_HEIGHT_PX}px`,
		fontFamily: typographyVars['--font-family-body'],
		userSelect: 'none',
		paddingInline: spacingVars['--spacing-1']
	},
	disabled: {
		opacity: 0.5,
		pointerEvents: 'none' as const
	},
	tokenSpan: {
		display: 'inline-flex',
		alignItems: 'center',
		height: '1lh',
		verticalAlign: 'top'
	}
});

export function chatComposerInputRootAttrs(
	isDisabled: boolean,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(styles.root, isDisabled && styles.disabled, xstyle);
}

export function chatComposerInputEditableAttrs(): SvelteStyleAttrs {
	return sx(styles.editable);
}

export function chatComposerInputPlaceholderAttrs(): SvelteStyleAttrs {
	return sx(styles.placeholder);
}

/**
 * The token chip's own span. `insertToken` writes the same four declarations
 * imperatively onto the span it creates (it cannot carry a compiled class), so
 * the two must stay in step.
 */
export function chatComposerInputTokenSpanAttrs(): SvelteStyleAttrs {
	return sx(styles.tokenSpan);
}
