import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, fontWeightVars, radiusVars, spacingVars } from '../../styles/tokens.stylex.js';

/**
 * Ported from Astryx's `PowerSearchBottomSheet.tsx` styles, all applied inside
 * the sheet flow rather than exported as public API.
 *
 * Every one reaches a plain `stylex.props` call site, so upstream's compiler
 * folded the whole module into literal class strings; none of it appears as a
 * style object in `dist/PowerSearchBottomSheet.js`. This module therefore
 * writes each key through an attrs helper — the tree-shaking guard the repo
 * documents — and the class oracle has no case for it because the tarball
 * carries nothing to diff. The sheet's own pixels are checked through the
 * shipped CSS oracle instead.
 */
const styles = stylex.create({
	// 44px touch targets for every sheet action, without resizing inputs.
	touchAction: {
		minHeight: 44
	},
	// A sheet action drawn smaller than 44px keeps its drawn size and grows
	// only its hit area to 44px, under a coarse pointer. The custom properties
	// carry the media condition because StyleX allows plain values inside a
	// pseudo-element. On a fine pointer the overlay is not generated, so it
	// never takes hover from the action's own content.
	touchHitArea: {
		'--_power-search-sheet-hit-inset': {
			default: '0px',
			'@media (pointer: coarse)': 'min(0px, calc((100% - 44px) / 2))'
		},
		'--_power-search-sheet-hit-content': {
			default: 'none',
			'@media (pointer: coarse)': '""'
		},
		'::after': {
			content: 'var(--_power-search-sheet-hit-content)',
			position: 'absolute',
			inset: 'var(--_power-search-sheet-hit-inset)'
		}
	},
	// Scopes the sticky header's and footer's layer to this sheet's content:
	// the List rows are `position: relative` and come after the header, so
	// without a layer of its own the header is painted under the rows that
	// scroll beneath it. Isolating the content keeps that z-index inside it, so
	// the sheet's grab handle (z-index 1 on the panel, outside this wrapper)
	// still paints above.
	sheet: {
		display: 'flex',
		flexDirection: 'column',
		minHeight: '100%',
		isolation: 'isolate'
	},
	// The Filters and Add filter sheets fill the panel and scroll only their
	// viewport, so the header and footer stay fixed.
	sheetWithFixedFooter: {
		height: '100%',
		overflow: 'hidden'
	},
	header: {
		position: 'sticky',
		insetBlockStart: 0,
		// Above the rows that scroll under it, within the isolated sheet content.
		zIndex: 1,
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-3'],
		paddingBlockEnd: spacingVars['--spacing-3'],
		paddingInline: spacingVars['--spacing-4'],
		backgroundColor: colorVars['--color-background-surface']
	},
	// The value sheet scrolls its whole content, so its sticky header can reach
	// the sheet's top. The header rises into the band that the sheet keeps
	// under its grab bar and keeps its own padding there, so it clears the bar
	// at rest and while stuck. The Filters and Add filter sheets do not scroll
	// their header, and the band alone clears the bar.
	headerScrollsToTop: {
		marginBlockStart: `calc(-1 * ${spacingVars['--spacing-6']})`,
		paddingBlockStart: spacingVars['--spacing-6']
	},
	headerRow: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2']
	},
	headerText: {
		minWidth: 0,
		flexGrow: 1,
		display: 'flex',
		flexDirection: 'column'
	},
	// The body pads the sheet's content and publishes that inline padding as
	// the container padding its lists read: with `edge="bleed"` their rows run
	// edge to edge (full-bleed dividers) while row text keeps this inset, so
	// row text, group headings and the sheet title share one edge.
	body: {
		flexGrow: 1,
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-4'],
		paddingInline: spacingVars['--spacing-4'],
		paddingBlockEnd: spacingVars['--spacing-4']
	},
	// The viewport reaches the sheet edge, so its scrollbar does too; the
	// content inside it carries the body's padding.
	scrollViewport: {
		flexGrow: 1,
		minHeight: 0,
		overflowY: 'auto',
		overscrollBehaviorY: 'contain'
	},
	scrollContent: {
		minHeight: '100%',
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-4'],
		paddingInline: spacingVars['--spacing-4'],
		paddingBlockEnd: spacingVars['--spacing-4']
	},
	footer: {
		position: 'sticky',
		insetBlockEnd: 0,
		zIndex: 1,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-3'],
		paddingInline: spacingVars['--spacing-4'],
		backgroundColor: colorVars['--color-background-surface']
	},
	fixedFooter: {
		position: 'relative',
		insetBlockEnd: 'auto',
		flexShrink: 0
	},
	footerEqualAction: {
		flexGrow: 1,
		flexBasis: 0,
		minWidth: 0,
		minHeight: 44
	},
	footerSoleAction: {
		flexGrow: 1
	},
	empty: {
		paddingBlock: spacingVars['--spacing-6'],
		textAlign: 'center'
	},
	emptyState: {
		flexGrow: 1,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center'
	},
	// With more than one section in the value step, each section is a muted
	// container.
	controlSection: {
		padding: spacingVars['--spacing-3'],
		borderRadius: radiusVars['--radius-container'],
		backgroundColor: colorVars['--color-background-muted']
	},
	// The built-in nested editor's sub-filter rows collapse from one line to
	// wrapped lines under a container query on the popover's own container;
	// the sheet renders no such container, so the editor's tree root is the
	// query container here, and at phone widths the rows wrap instead of
	// running past the sheet's edge.
	nestedEditorContainer: {
		containerType: 'inline-size',
		overflow: 'hidden'
	},
	rowValue: {
		fontWeight: fontWeightVars['--font-weight-bold']
	},
	editorInput: {
		paddingBlockStart: spacingVars['--spacing-1']
	}
});

/** A sheet action whose drawn height is already 44px. */
export const powerSearchSheetTouchActionStyle = styles.touchAction;

export function powerSearchSheetTouchActionAttrs(): SvelteStyleAttrs {
	return sx(styles.touchAction);
}

/** A smaller sheet action with a 44px hit area under a coarse pointer. */
export const powerSearchSheetTouchHitAreaStyle = styles.touchHitArea;

export function powerSearchSheetTouchHitAreaAttrs(): SvelteStyleAttrs {
	return sx(styles.touchHitArea);
}

/** The sheet's content wrapper; the Filters and Add filter sheets pin it full height. */
export function powerSearchSheetAttrs(hasFixedFooter = false): SvelteStyleAttrs {
	return sx(styles.sheet, hasFixedFooter && styles.sheetWithFixedFooter);
}

/** The sticky sheet header. */
export function powerSearchSheetHeaderAttrs(scrollsToTop = false): SvelteStyleAttrs {
	return sx(styles.header, scrollsToTop && styles.headerScrollsToTop);
}

/** The title row inside the header. */
export function powerSearchSheetHeaderRowAttrs(): SvelteStyleAttrs {
	return sx(styles.headerRow);
}

/** The header's title column. */
export function powerSearchSheetHeaderTextAttrs(): SvelteStyleAttrs {
	return sx(styles.headerText);
}

/** The scroll viewport that reaches the sheet edge. */
export function powerSearchSheetScrollViewportAttrs(): SvelteStyleAttrs {
	return sx(styles.scrollViewport);
}

/** The value step's padded, non-scrolling body. */
export function powerSearchSheetBodyAttrs(): SvelteStyleAttrs {
	return sx(styles.body);
}

/**
 * The body's raw style object, for call sites that must merge the published
 * container padding in the same `sx()` call.
 */
export const powerSearchSheetBodyStyle = styles.body;

/** The padded content inside the scroll viewport. */
export function powerSearchSheetScrollContentAttrs(): SvelteStyleAttrs {
	return sx(styles.scrollContent);
}

/** The scroll content's raw style object, merged with the container padding. */
export const powerSearchSheetScrollContentStyle = styles.scrollContent;

/** The sticky (or fixed) action row. */
export function powerSearchSheetFooterAttrs(isFixed = false): SvelteStyleAttrs {
	return sx(styles.footer, isFixed && styles.fixedFooter);
}

/** One of two equal-width footer actions. */
export const powerSearchSheetFooterEqualActionStyle = styles.footerEqualAction;

export function powerSearchSheetFooterEqualActionAttrs(): SvelteStyleAttrs {
	return sx(styles.footerEqualAction);
}

/** The only footer action, grown across the row. */
export const powerSearchSheetFooterSoleActionStyle = styles.footerSoleAction;

export function powerSearchSheetFooterSoleActionAttrs(): SvelteStyleAttrs {
	return sx(styles.footerSoleAction);
}

/** A plain message block in the value step. */
export function powerSearchSheetEmptyAttrs(): SvelteStyleAttrs {
	return sx(styles.empty);
}

/** The section holder for an empty-state panel. */
export const powerSearchSheetEmptyStateStyle = styles.emptyState;

export function powerSearchSheetEmptyStateAttrs(): SvelteStyleAttrs {
	return sx(styles.emptyState);
}

/** A muted container around one section of the value step. */
export function powerSearchSheetControlSectionAttrs(): SvelteStyleAttrs {
	return sx(styles.controlSection);
}

/** The container-query root for the built-in nested editor in a sheet. */
export const powerSearchSheetNestedEditorContainerStyle = styles.nestedEditorContainer;

export function powerSearchSheetNestedEditorContainerAttrs(): SvelteStyleAttrs {
	return sx(styles.nestedEditorContainer);
}

/** A Filters row's bold value segment. */
export function powerSearchSheetRowValueAttrs(): SvelteStyleAttrs {
	return sx(styles.rowValue);
}

/** The top padding above a sheet value editor. */
export function powerSearchSheetEditorInputAttrs(): SvelteStyleAttrs {
	return sx(styles.editorInput);
}
