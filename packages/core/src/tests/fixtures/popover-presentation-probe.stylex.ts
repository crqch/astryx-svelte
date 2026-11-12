import * as stylex from '@stylexjs/stylex';

/**
 * The `xstyle` half of the Popover presentation's styling case. Upstream passes
 * a StyleX style with `outlineWidth: 3`; this probe lets the case assert the
 * class reaches the sheet's panel, not just an inline style.
 */
export const popoverPresentationProbe = stylex.create({
	sheetOutline: {
		outlineStyle: 'solid',
		outlineWidth: 3
	}
});
