import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../../internal/sx.js';
import { colorVars, sizeVars, spacingVars } from '../../../styles/tokens.stylex.js';
import { rtlStyles } from '../../../utils/rtl.stylex.js';

/**
 * Ported from the styles declared in Astryx's
 * `Markdown/plugins/HeadingLinksRenderer.tsx`.
 *
 * Group names and declarations are upstream's (`styles`, `dynamicStyles`) so
 * the emitted atomic classes pair with upstream's sheet byte for byte — in
 * particular `row`'s `align-items: last baseline` and `controlSlot`'s
 * `margin-inline-start`, the two rules the CSS oracle skips while the renderer
 * is unported.
 */

const COARSE_TARGET = '24px';

const ALIGN_MARGIN = {
	start: '0',
	center: 'auto'
} as const;

const dynamicStyles = stylex.create({
	proseWidth: (maxWidth: string) => ({ maxWidth }),
	proseAlign: (marginInline: string) => ({ marginInline })
});

const styles = stylex.create({
	row: {
		display: 'flex',
		alignItems: 'last baseline',
		minWidth: 0,
		maxWidth: '100%',
		overflow: 'visible',
		isolation: 'isolate'
	},
	heading: {
		flex: '0 1 auto',
		minWidth: 0,
		marginBlock: 0
	},
	controlSlot: {
		position: 'relative',
		display: 'inline-block',
		flexShrink: 0,
		zIndex: 1,
		inlineSize: {
			default: sizeVars['--size-element-sm'],
			'@media (any-pointer: coarse)': COARSE_TARGET
		},
		marginInlineStart: spacingVars['--spacing-1-5'],
		color: colorVars['--color-text-secondary'],
		fontFamily: 'inherit',
		fontSize: 'inherit',
		fontWeight: 'inherit',
		lineHeight: 'inherit'
	},
	baselineProbe: {
		visibility: 'hidden'
	},
	copyButton: {
		position: 'absolute',
		insetBlockStart: '50%',
		inlineSize: {
			default: sizeVars['--size-element-sm'],
			'@media (any-pointer: coarse)': COARSE_TARGET
		},
		blockSize: {
			default: sizeVars['--size-element-sm'],
			'@media (any-pointer: coarse)': COARSE_TARGET
		},
		paddingBlock: 0,
		paddingInline: 0,
		color: 'inherit',
		fontFamily: 'inherit',
		fontSize: 'inherit',
		fontWeight: 'inherit',
		lineHeight: 'inherit'
	},
	glyph: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		inlineSize: '1em',
		blockSize: '1em'
	}
});

/** @internal Applied only while this module owns the built-in heading row. */
export const headingLinksHeadingStyle = styles.heading;

/**
 * The row wrapper: upstream's `styles.row` plus the heading text style, block
 * spacing, prose width and prose alignment, in that order.
 */
export function headingLinksRowAttrs(
	headingTextStyle: StyleArg,
	blockSpacingStyle: StyleArg,
	contentWidth: string | null,
	contentAlign: 'start' | 'center'
): SvelteStyleAttrs {
	return sx(
		styles.row,
		headingTextStyle,
		blockSpacingStyle,
		contentWidth != null ? dynamicStyles.proseWidth(contentWidth) : null,
		contentAlign !== 'start' ? dynamicStyles.proseAlign(ALIGN_MARGIN[contentAlign]) : null
	);
}

/** The inline control slot after the heading. */
export function headingLinksControlSlotAttrs(): SvelteStyleAttrs {
	return sx(styles.controlSlot);
}

/** The invisible `#` that gives the control slot the heading's baseline box. */
export function headingLinksBaselineProbeAttrs(): SvelteStyleAttrs {
	return sx(styles.baselineProbe);
}

/** The copy button's `xstyle`, centred on the slot in both directions. */
export const headingLinksCopyButtonXstyle: StyleArg = [
	styles.copyButton,
	rtlStyles.centerInline('-50%')
];

/** The fixed `1em` box around the copied-state icon or `#`. */
export function headingLinksGlyphAttrs(): SvelteStyleAttrs {
	return sx(styles.glyph);
}
