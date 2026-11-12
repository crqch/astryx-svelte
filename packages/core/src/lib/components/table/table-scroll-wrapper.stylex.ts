import * as stylex from '@stylexjs/stylex';
import { type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { borderVars, colorVars, focusVars } from '../../styles/tokens.stylex.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';

/**
 * Ported from the styles declared in Astryx's `Table/Table.tsx` — the
 * table-level style plugin's `tableStyles` and the scroll container's
 * `scrollWrapperStyles`. They live together because upstream declares them in
 * one module; group names are upstream's so the class oracle needs no renames.
 */

const tableStyles = stylex.create({
	base: {
		fontFamily: 'inherit',
		color: colorVars['--color-text-primary']
	}
});

const scrollWrapperStyles = stylex.create({
	// A windowed table scrolls inside the height its parent gives it. As its
	// container's first or last child, the region bleeds over that block edge's
	// padding (containerBleed), so its height adds that padding back and it
	// ends at the same edge.
	blockViewport: {
		'--_table-bleed-block-start': {
			default: '0px',
			':first-child': 'var(--container-padding-block-start, 0px)'
		},
		'--_table-bleed-block-end': {
			default: '0px',
			':last-child': 'var(--container-padding-block-end, 0px)'
		},
		height: 'calc(100% + var(--_table-bleed-block-start) + var(--_table-bleed-block-end))',
		minHeight: 0
	},
	base: {
		overflowX: 'auto',
		WebkitOverflowScrolling: 'touch'
	},
	containerBleed: {
		marginInlineStart: 'calc(-1 * var(--container-padding-inline-start, 0px))',
		marginInlineEnd: 'calc(-1 * var(--container-padding-inline-end, 0px))',
		width:
			'calc(100% + var(--container-padding-inline-start, 0px) + var(--container-padding-inline-end, 0px))',
		marginTop: {
			default: null,
			':first-child': 'calc(-1 * var(--container-padding-block-start, 0px))'
		},
		marginBottom: {
			default: null,
			':last-child': 'calc(-1 * var(--container-padding-block-end, 0px))'
		},
		// As its container's first or last child, the region reaches that block
		// edge. There it takes the published corner, so its ring and fills follow
		// the curve. Every other corner is square.
		borderStartStartRadius: {
			default: '0px',
			':first-child': 'var(--container-corner-start-start, 0px)'
		},
		borderStartEndRadius: {
			default: '0px',
			':first-child': 'var(--container-corner-start-end, 0px)'
		},
		borderEndStartRadius: {
			default: '0px',
			':last-child': 'var(--container-corner-end-start, 0px)'
		},
		borderEndEndRadius: {
			default: '0px',
			':last-child': 'var(--container-corner-end-end, 0px)'
		}
	},
	// The wrapper bleeds to its container's edges, under a Card's border, and
	// the Card clips there, so its keyboard ring sits inside its own box, clear
	// of that border too.
	focusRingInset: {
		outlineOffset: {
			default: null,
			':focus-visible': `calc(-1 * (${focusVars['--focus-outline-width']} + ${borderVars['--border-width']}))`
		}
	}
});

/** The `<table>` styles the table-level plugin appends to the pipeline. */
export const tableBaseStyle: StyleArg = tableStyles.base;

/** The horizontal scroll container around the `<table>`. */
export function tableScrollWrapperAttrs(
	pluginStyles: StyleArg[] | undefined,
	hasBlockViewport = false
): SvelteStyleAttrs {
	// A tab stop once the table scrolls inline: the shared ring, which a theme
	// restyles through the focus-outline tokens.
	return focusOutlineProps.focusVisible(
		scrollWrapperStyles.base,
		scrollWrapperStyles.containerBleed,
		scrollWrapperStyles.focusRingInset,
		hasBlockViewport && scrollWrapperStyles.blockViewport,
		...(pluginStyles ?? [])
	);
}
