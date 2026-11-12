import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { dateInputTouchGeometry, dateInputTouchSizes } from './tokens.stylex.js';

/**
 * Ported from Astryx's `DateInput/PickerWheel.tsx`, where the styles are inline
 * in the component file.
 *
 * The touch column is not a scroller: one absolutely positioned strip holds
 * the rows at their places along the wheel, and that strip alone moves. The
 * rows fade toward the column's edges through a static mask, so nothing paints
 * again as the strip moves.
 */

/**
 * The rows' opacity at the column's edges. At 0.7 the row four from the band
 * keeps 5:1 or more in every shipped theme, a margin over WCAG AA's 4.5:1.
 */
const FADE_FLOOR = 0.7;

const styles = stylex.create({
	// The scrolling column's box, band and rows, moved by the gesture system and
	// the compositor instead of a native scroller.
	column: {
		position: 'relative',
		flex: '1 1 0',
		minInlineSize: 0,
		blockSize: dateInputTouchGeometry.paneBlockSize,
		overflow: 'hidden',
		outline: 'none',
		WebkitTapHighlightColor: 'transparent'
	},
	// The rows fade toward the column's edges. A static mask: nothing paints it
	// again as the strip moves. It sits inside the column, so it never clips the
	// column's focus ring.
	fade: {
		position: 'absolute',
		inset: 0,
		pointerEvents: 'none',
		maskImage: `linear-gradient(to bottom, rgb(0 0 0 / ${FADE_FLOOR}), rgb(0 0 0) 50%, rgb(0 0 0 / ${FADE_FLOOR}))`
	},
	/**
	 * The selection band: a centred row-height plate behind the rows.
	 * Decorative: the committed value is announced by `aria-selected`.
	 */
	band: {
		position: 'absolute',
		insetInline: 0,
		insetBlockStart: `calc(50% - (${dateInputTouchSizes.wheelItemSize} / 2))`,
		blockSize: dateInputTouchSizes.wheelItemSize,
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: colorVars['--color-neutral'],
		pointerEvents: 'none'
	},
	/**
	 * The strip holds the rows at their places along the wheel, with its top on
	 * the band's row. It moves by minus the wheel's offset, and the animator
	 * writes its `translate`. Also what a reduced-motion cross-fade fades.
	 */
	strip: {
		position: 'absolute',
		insetInline: 0,
		insetBlockStart: `calc(50% - (${dateInputTouchSizes.wheelItemSize} / 2))`,
		pointerEvents: 'none'
	},
	/** One row: an option at its place along the strip, flat. */
	row: {
		position: 'absolute',
		insetInline: 0,
		blockSize: dateInputTouchSizes.wheelItemSize,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		paddingInline: spacingVars['--spacing-2'],
		boxSizing: 'border-box',
		fontSize: typeScaleVars['--text-large-size'],
		fontWeight: fontWeightVars['--font-weight-normal'],
		color: colorVars['--color-text-primary'],
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		userSelect: 'none'
	},
	/** The row under the band, as the scrolling column marks it. */
	rowActive: {
		color: colorVars['--color-text-accent'],
		fontWeight: fontWeightVars['--font-weight-semibold']
	},
	rowDisabled: {
		color: colorVars['--color-text-disabled']
	},
	/** A row at its place along the strip. */
	rowAt: (top: string) => ({ insetBlockStart: top })
});

/** The touch column's box, which draws the focus ring around the fade. */
export function pickerWheelColumnAttrs(): SvelteStyleAttrs {
	return sx(styles.column, focusOutlineStyles.focusVisible);
}

/** The static mask that fades the rows toward the column's edges. */
export function pickerWheelFadeAttrs(): SvelteStyleAttrs {
	return sx(styles.fade);
}

/** The decorative selection plate behind the rows. */
export function pickerWheelBandAttrs(): SvelteStyleAttrs {
	return sx(styles.band);
}

/** The absolutely positioned strip the animator moves. */
export function pickerWheelStripAttrs(): SvelteStyleAttrs {
	return sx(styles.strip);
}

/**
 * One `role="option"` row at `top` px along the strip. The order is upstream's
 * lookup table: `row`, then the row's offset, then the active highlight, then
 * the disabled treatment — so a disabled row that also happens to be active
 * reads as disabled.
 */
export function pickerWheelRowAttrs(
	top: number,
	isActive: boolean,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		styles.row,
		styles.rowAt(`${top}px`),
		isActive && styles.rowActive,
		isDisabled && styles.rowDisabled
	);
}
