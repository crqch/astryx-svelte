import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { borderVars, colorVars, spacingVars, typeScaleVars } from '../../styles/tokens.stylex.js';
import { rowPressLayerStyles } from '../../private-attributes/press.stylex.js';
import { travellingStyles } from '../../private-attributes/travelling.stylex.js';
import type { ListEdge } from './list-context.svelte.js';

/**
 * Ported from Astryx's `List/ListItem.tsx` styles.
 *
 * The `styles`, `embeddedStyles` and `taskMarkerStyles` keys survive into
 * upstream's `dist/` as objects because they reach `Item` inside an `xstyle`
 * array beside conditionals. The `markerStyles.container` wrapper and the
 * `dot`/`circle`/`square` shapes are each applied at a single call site, so the
 * compiler folded them into literal class strings; this port keeps every key in
 * an attrs helper so the same declarations stay checkable.
 */
const styles = stylex.create({
	numberColumns: {
		display: {
			default: 'flex',
			'@supports (grid-template-columns: subgrid)': 'grid'
		},
		gridTemplateColumns: 'subgrid',
		gridColumn: '1 / -1'
	},
	// A numbered row outside the shared columns still spans the List's grid.
	spanNumberColumns: {
		gridColumn: '1 / -1'
	},
	withCounter: {
		counterIncrement: 'astryx-list'
	},
	// List's edge treatments. Each reads --_item-inset-inline, the variable
	// Item derives its paddingInline from, on the row itself (custom properties
	// only cascade downward, so the <ul> cannot read it); density and theme
	// paddingInline overrides on `item` move it. Each edge resolves against ITS
	// OWN container padding var, so asymmetric padding never over-reaches an
	// edge, and logical properties keep RTL correct.
	//
	// 'flush': no inset, so content meets the row's edges.
	edgeFlush: {
		'--_item-inset-inline': '0px'
	},
	// 'outset': the list reaches the container's padding edge (List.tsx); the
	// row steps back in by whatever padding its inset does not fill, so the row
	// reaches min(inset, container padding) past the content line and its text
	// lands on that line when the padding is at least the inset.
	edgeOutset: {
		marginInlineStart:
			'max(var(--container-padding-inline-start, 0px) - var(--_item-inset-inline), 0px)',
		marginInlineEnd:
			'max(var(--container-padding-inline-end, 0px) - var(--_item-inset-inline), 0px)'
	},
	// 'bleed': the row fills the list, which reaches the container's padding
	// edge (List.tsx); its text sits on the container's padding line, never
	// closer to the row's edge than its own inset. Square corners where the row
	// meets the container's straight sides; the first and last rows take the
	// corners the list publishes for a rounded container's corner.
	edgeBleed: {
		paddingInlineStart:
			'max(var(--container-padding-inline-start, 0px), var(--_item-inset-inline))',
		paddingInlineEnd: 'max(var(--container-padding-inline-end, 0px), var(--_item-inset-inline))',
		borderRadius: 0,
		borderStartStartRadius: {
			default: null,
			':first-child': 'var(--_list-corner-start-start, 0px)'
		},
		borderStartEndRadius: {
			default: null,
			':first-child': 'var(--_list-corner-start-end, 0px)'
		},
		borderEndStartRadius: {
			default: null,
			':last-child': 'var(--_list-corner-end-start, 0px)'
		},
		borderEndEndRadius: {
			default: null,
			':last-child': 'var(--_list-corner-end-end, 0px)'
		}
	},
	// Under a finger, the row's touch band rises above the rows after it. A
	// later row is positioned with no z-index, so it would paint and hit-test
	// over the band. Only inside a List (isInList). The band itself is the
	// shared touch-hit-area layer, which this port has not ported yet; the key
	// stays wired so the List is ready when it lands.
	bandRaised: {
		'::after': {
			zIndex: { default: null, '@media (pointer: coarse)': 1 }
		}
	},
	withDivider: {
		borderBlockEndWidth: borderVars['--border-width'],
		borderBlockEndStyle: 'solid',
		borderBlockEndColor: colorVars['--color-border'],
		// A longhand, not the `borderBlockEnd` shorthand: StyleX's default
		// property-specificity mode drops border shorthands silently, so the
		// shorthand never reached the shipped CSS and the last item kept its
		// divider.
		':last-child': {
			borderBlockEndWidth: 0
		},
		// The touch hit layer's band starts past the divider, the edge of the box
		// its insets are measured from (internal/touchHitArea.stylex.ts). The
		// width sits on the layer itself, so content inside the row never
		// inherits it. That layer is not ported yet, so nothing reads this
		// var today; the key stays wired for when it is.
		'::after': {
			'--_hit-border-bottom': {
				default: borderVars['--border-width'],
				':last-child': '0px'
			}
		}
	}
});

// Custom-rendered markers instead of native `list-style-type`; numbers come from
// a CSS counter, the same pattern upstream uses.
const MARKER_DOT_SIZE = 6;

/**
 * How far a counter wider than its marker reaches toward the row's edge: the
 * row's whole inline inset, the way a native outside marker hangs into its
 * list's padding. Up to that width the item's text keeps its usual start; a
 * wider counter widens the List's shared column instead. It is never clipped:
 * the inset is inside the row, and the row inside the List's inline clip.
 * Markdown's outside counters use a separate rule (`gutterHang`).
 */
const COUNTER_HANG = 'calc(-1 * var(--_item-inset-inline))';

const markerStyles = stylex.create({
	container: {
		alignSelf: 'baseline',
		boxSizing: 'border-box',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		width: spacingVars['--spacing-4'],
		marginTop: `calc((1em * ${typeScaleVars['--text-body-leading']} - ${MARKER_DOT_SIZE}px) / 2)`
	},
	dot: {
		width: MARKER_DOT_SIZE,
		height: MARKER_DOT_SIZE,
		borderRadius: '50%',
		backgroundColor: colorVars['--color-text-primary']
	},
	circle: {
		width: MARKER_DOT_SIZE,
		height: MARKER_DOT_SIZE,
		borderRadius: '50%',
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: colorVars['--color-text-primary'],
		backgroundColor: 'transparent'
	},
	square: {
		width: MARKER_DOT_SIZE,
		height: MARKER_DOT_SIZE,
		backgroundColor: colorVars['--color-text-primary']
	},
	number: {
		alignSelf: 'baseline',
		// The counter ends where the marker ends, so every period in a list lines
		// up, as a native outside marker's does. Tabular figures give each digit
		// the same width down the list.
		display: 'flex',
		justifyContent: 'flex-end',
		flexShrink: 0,
		color: colorVars['--color-text-primary'],
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading'],
		fontVariantNumeric: 'tabular-nums',
		// Short counters retain their inset. A longer counter first reaches into
		// the row's inline inset (COUNTER_HANG) and only then sizes the List's
		// shared grid column, so no single number moves its item's text.
		minWidth: spacingVars['--spacing-4'],
		width: 'auto',
		whiteSpace: 'nowrap'
	},
	// A number outside a counter style's range (zero or below, or past 3999
	// in roman) is written in decimal, as CSS counter styles fall back.
	decimal: {
		'::before': {
			content: 'counter(astryx-list) "."',
			marginInlineStart: COUNTER_HANG
		}
	},
	lowerAlpha: {
		'::before': {
			content: 'counter(astryx-list, lower-alpha) "."',
			marginInlineStart: COUNTER_HANG
		}
	},
	lowerRoman: {
		'::before': {
			content: 'counter(astryx-list, lower-roman) "."',
			marginInlineStart: COUNTER_HANG
		}
	},
	// Markdown's non-swipe lists allow outside marker paint. Keep their marker
	// column at the ordinary themed width, as RichText's native outside markers
	// do. The counter itself stays intrinsic and unbroken; flex-end aligns its
	// end even when it overflows toward inline-start.
	gutterHang: {
		width: spacingVars['--spacing-4'],
		'::before': {
			marginInlineStart: 0,
			flexShrink: 0
		}
	}
});

/** The width and height of CheckboxInput's small control. */
const TASK_CHECKBOX_SIZE = 20;

const taskMarkerStyles = stylex.create({
	// A task item's checkbox stands where the marker would, centered on the
	// item's first line, as a task list's checkboxes are.
	container: {
		alignSelf: 'flex-start',
		display: 'flex',
		flexShrink: 0,
		marginTop: `calc((1em * ${typeScaleVars['--text-body-leading']} - ${TASK_CHECKBOX_SIZE}px) / 2)`
	}
});

/** The number styles, by marker. */
const NUMBER_STYLES = {
	decimal: markerStyles.decimal,
	'lower-alpha': markerStyles.lowerAlpha,
	'lower-roman': markerStyles.lowerRoman
} as const;

export type NumberMarker = keyof typeof NUMBER_STYLES;

const embeddedStyles = stylex.create({
	noRadius: {
		borderRadius: 0
	}
});

export interface ListItemXstyleOptions {
	/** `listStyle !== 'none'`. */
	hasMarkers: boolean;
	/** `listStyle === 'decimal'`: the List lays out shared number columns. */
	isOrdered: boolean;
	/** This row joins the List's shared number columns. */
	usesNumberColumns: boolean;
	hasDividers: boolean;
	/** The press layer covers both dividers under a finger. */
	hasPressDividers: boolean;
	/** The row is interactive and enabled. */
	isTouchTarget: boolean;
	/** The row is inside a List, where the list isolates its rows. */
	isInList: boolean;
	edge: ListEdge;
	xstyle: StyleArg;
}

/** The `xstyle` array `ListItem` hands to `Item`. */
export function listItemXstyle(options: ListItemXstyleOptions): StyleArg {
	const {
		hasMarkers,
		isOrdered,
		usesNumberColumns,
		hasDividers,
		hasPressDividers,
		isTouchTarget,
		isInList,
		edge,
		xstyle
	} = options;

	return [
		// A numbered row contributes two cells to the List's shared counter grid.
		usesNumberColumns && styles.numberColumns,
		// A numbered row outside the shared columns still spans the grid.
		isOrdered && !usesNumberColumns && styles.spanNumberColumns,
		hasMarkers && styles.withCounter,
		travellingStyles.row,
		hasDividers && styles.withDivider,
		hasDividers && embeddedStyles.noRadius,
		// A divider's tint reaches one divider past the row's edge under a
		// pointer, and the press layer covers both dividers under a finger.
		hasPressDividers && rowPressLayerStyles.overDividers,
		// Under a finger, only a List row raises its touch band: the List is
		// what isolates the rows, so nothing raised escapes to a sticky header.
		isTouchTarget && isInList && styles.bandRaised,
		edge === 'flush' && styles.edgeFlush,
		edge === 'outset' && styles.edgeOutset,
		edge === 'bleed' && styles.edgeBleed,
		xstyle
	];
}

/** The fixed-width slot holding a `disc`/`circle`/`square` marker. */
export function markerContainerAttrs(): SvelteStyleAttrs {
	return sx(markerStyles.container);
}

/** The filled `disc` bullet. */
export function markerDotAttrs(): SvelteStyleAttrs {
	return sx(markerStyles.dot);
}

/** The hollow `circle` bullet. */
export function markerCircleAttrs(): SvelteStyleAttrs {
	return sx(markerStyles.circle);
}

/** The filled `square` bullet. */
export function markerSquareAttrs(): SvelteStyleAttrs {
	return sx(markerStyles.square);
}

/**
 * The number marker — an empty span whose `::before` reads the counter. A
 * `hasMarkerGutter` row keeps the themed column and lets a long counter paint
 * outside it.
 */
export function markerNumberAttrs(
	marker: NumberMarker,
	hasMarkerGutter: boolean
): SvelteStyleAttrs {
	return sx(markerStyles.number, NUMBER_STYLES[marker], hasMarkerGutter && markerStyles.gutterHang);
}

/** The fixed slot placing a task item's checkbox where its marker would be. */
export function taskMarkerContainerAttrs(): SvelteStyleAttrs {
	return sx(taskMarkerStyles.container);
}
