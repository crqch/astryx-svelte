import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { spacingVars } from '../../styles/tokens.stylex.js';
import type { ListEdge, ListMarkerStyle } from './list-context.svelte.js';
import { reorderListStyle } from './list-reorder-handle.stylex.js';

/**
 * Ported from Astryx's `List/List.tsx` styles.
 *
 * `root`, `header` and `bleedCornersBelowHeader` only exist on the header
 * branch's two wrapper divs, which is why upstream's compiler folded them into
 * literal class strings and left no object behind in `dist/`.
 */
const styles = stylex.create({
	root: {
		display: 'flex',
		flexDirection: 'column'
	},
	list: {
		margin: 0,
		paddingInlineStart: 0,
		listStyleType: 'none',
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-0-5'],
		// A row dragged aside for its swipe actions paints past the list's
		// inline edge unless the list clips. `clip`, never `hidden`: hidden
		// makes a scroll container, which fights the list's vertical scroller.
		overflowInline: 'clip',
		// Under a finger, the isolation boundary for what rises inside the
		// list. A row's touch band and a swipeable row order above the rows
		// after them. They stay below a page-level sticky header at the same
		// z-index. With a mouse nothing rises, so the list keeps its stacking.
		isolation: { default: null, '@media (pointer: coarse)': 'isolate' }
	},
	// A list under an `animatedLayout` handle isolates for every pointer. A row
	// that slides across others rides above them with a mouse too, and it must
	// stay below a page-level sticky header.
	animatedIsolation: {
		isolation: 'isolate'
	},
	// Subgridded numbered rows contribute their marker's intrinsic width to one
	// column, so text and nested lists never move with an individual number.
	numberColumns: {
		display: {
			default: 'flex',
			'@supports (grid-template-columns: subgrid)': 'grid'
		},
		gridTemplateColumns: 'max-content minmax(0, 1fr)',
		columnGap: spacingVars['--spacing-2']
	},
	// 'outset' and 'bleed' rows reach into the container's padding. The list
	// reaches the container's padding edge on each inline edge first, so its
	// inline clip moves out with the rows instead of cutting them; each row
	// then places itself inside it. Container padding vars are inherited, so
	// the list can read them, while the rows' own inset is scoped to the rows.
	// Missing or reset container padding resolves to zero.
	reachesContainerPadding: {
		marginInlineStart: 'calc(-1 * var(--container-padding-inline-start, 0px))',
		marginInlineEnd: 'calc(-1 * var(--container-padding-inline-end, 0px))',
		width:
			'calc(100% + var(--container-padding-inline-start, 0px) + var(--container-padding-inline-end, 0px))'
	},
	// 'bleed' rows reach the container's padding edge inline, and keep its
	// block padding. The list passes its first and last rows the corner a
	// rounded container publishes, less that block padding. It is at a corner
	// only as the container's first or last child.
	bleedCorners: {
		'--_list-corner-start-start': {
			default: '0px',
			':first-child':
				'max(0px, var(--container-corner-start-start, 0px) - var(--container-padding-block-start, 0px))'
		},
		'--_list-corner-start-end': {
			default: '0px',
			':first-child':
				'max(0px, var(--container-corner-start-end, 0px) - var(--container-padding-block-start, 0px))'
		},
		'--_list-corner-end-start': {
			default: '0px',
			':last-child':
				'max(0px, var(--container-corner-end-start, 0px) - var(--container-padding-block-end, 0px))'
		},
		'--_list-corner-end-end': {
			default: '0px',
			':last-child':
				'max(0px, var(--container-corner-end-end, 0px) - var(--container-padding-block-end, 0px))'
		}
	},
	// With a header, the list's root is the container's child, and the header
	// sits above the first row.
	bleedCornersBelowHeader: {
		'--_list-corner-start-start': '0px',
		'--_list-corner-start-end': '0px',
		'--_list-corner-end-start': {
			default: '0px',
			':last-child':
				'max(0px, var(--container-corner-end-start, 0px) - var(--container-padding-block-end, 0px))'
		},
		'--_list-corner-end-end': {
			default: '0px',
			':last-child':
				'max(0px, var(--container-corner-end-end, 0px) - var(--container-padding-block-end, 0px))'
		}
	},
	withDividers: {
		gap: 0
	},
	withCounter: {
		counterReset: 'astryx-list'
	},
	header: {
		marginBottom: spacingVars['--spacing-2']
	}
});

const dynamicStyles = stylex.create({
	counterStart: (value: number) => ({
		counterReset: `astryx-list ${value}`
	})
});

/**
 * The column wrapper around a header + its list, including the corner vars a
 * bleeding list publishes to its last row when the root is the container's
 * child. Header branch only.
 */
export function listRootAttrs(edge: ListEdge): SvelteStyleAttrs {
	return sx(styles.root, edge === 'bleed' && styles.bleedCornersBelowHeader);
}

/** The header block above the list. */
export function listHeaderAttrs(): SvelteStyleAttrs {
	return sx(styles.header);
}

export interface ListAttrsOptions {
	hasAnimatedLayout: boolean;
	isOrdered: boolean;
	hasDividers: boolean;
	edge: ListEdge;
	/** Whether this component renders a header. */
	hasHeader: boolean;
	listStyle: ListMarkerStyle;
	start: number | undefined;
	/** The list carries a reorder session: its insertion line. */
	hasReorder: boolean;
	xstyle: StyleArg;
}

/**
 * The `<ul>`/`<ol>` itself. A marker style seeds the CSS counter — at
 * `start - 1`, since the first item's `counter-increment` runs before its
 * `::before` reads it.
 */
export function listAttrs(options: ListAttrsOptions): SvelteStyleAttrs {
	const {
		hasAnimatedLayout,
		isOrdered,
		hasDividers,
		edge,
		hasHeader,
		listStyle,
		start,
		hasReorder,
		xstyle
	} = options;
	const reachesContainerPadding = edge === 'outset' || edge === 'bleed';

	return sx(
		styles.list,
		hasAnimatedLayout && styles.animatedIsolation,
		isOrdered && styles.numberColumns,
		hasDividers && styles.withDividers,
		reachesContainerPadding && styles.reachesContainerPadding,
		edge === 'bleed' && !hasHeader && styles.bleedCorners,
		listStyle !== 'none' &&
			(start != null && start !== 1 ? dynamicStyles.counterStart(start - 1) : styles.withCounter),
		hasReorder && reorderListStyle,
		xstyle
	);
}
