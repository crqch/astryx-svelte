import * as stylex from '@stylexjs/stylex';
import { sx, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	fontWeightVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';
import type { ItemSwipeActionVariant } from './item-swipe-types.js';
import type { SwipeSide } from './use-swipe-action.svelte.js';

/**
 * Ported from Astryx's `Item/ItemSwipeLayer.tsx`.
 *
 * The two swipe panels and their entries. The panel is an out-of-flow child of
 * the row root at the inline start or end, counter-translated so it appears
 * fixed in the space the row vacates, and exactly as wide as the travel toward
 * its side — a padded box at `width: 0` would still paint its padding, so the
 * panel has none; its entries carry their own. Not a pixel of it shows at rest.
 */

// The custom properties the gesture writes on the root (see use-swipe-action;
// StyleX wants literals here, so the names are spelled out rather than imported).
/** The travel a drag writes on the row root, in physical px. */
const SWIPE_TRAVEL = 'var(--_item-swipe-travel, 0px)';
/** +1 when the inline end is to the right, -1 under RTL; written beside the travel. */
const SWIPE_DIR = 'var(--_item-swipe-dir, 1)';
/** The settle clock, `0s` while the finger drives the row. */
const SWIPE_DURATION = 'var(--_item-swipe-duration, 0s)';
/** The travel measured toward the inline end. */
const SWIPE_LOGICAL_TRAVEL = `calc(${SWIPE_TRAVEL} * ${SWIPE_DIR})`;

const styles = stylex.create({
	// A side's panel: an out-of-flow child of the root at the inline start or
	// end, counter-translated so it appears fixed in the space the row
	// vacates, and exactly as wide as the travel toward its side — a padded box
	// at `width: 0` would still paint its padding, so the panel has none; its
	// entries carry their own. Not a pixel of it shows at rest.
	swipePanel: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		width: 0,
		display: 'flex',
		alignItems: 'stretch',
		boxSizing: 'border-box',
		overflow: 'hidden',
		borderRadius: 'inherit',
		transform: `translate3d(calc(-1 * ${SWIPE_TRAVEL}), 0, 0)`,
		transitionProperty: 'transform, width',
		transitionDuration: `${SWIPE_DURATION}, ${SWIPE_DURATION}`,
		transitionTimingFunction: 'ease-out, ease-out'
	},
	swipePanelLeading: {
		insetInlineStart: 0,
		justifyContent: 'flex-start',
		width: `max(0px, ${SWIPE_LOGICAL_TRAVEL})`
	},
	swipePanelTrailing: {
		insetInlineEnd: 0,
		justifyContent: 'flex-end',
		width: `max(0px, calc(-1 * ${SWIPE_LOGICAL_TRAVEL}))`
	},
	// The entries at their natural width; the panel clips them to the travel.
	// The outermost entry is the last, at the panel's outer edge: on the leading
	// side that is the inline start, so the row of entries runs in reverse.
	swipeEntries: {
		display: 'flex',
		flexShrink: 0,
		height: '100%',
		// The entries sit on the surface, not on the panel's own colour: the
		// neutral variant is translucent and would otherwise take the outermost
		// entry's colour through it.
		backgroundColor: colorVars['--color-background-surface']
	},
	swipeEntriesLeading: {
		flexDirection: 'row-reverse'
	},
	swipeEntry: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacingVars['--spacing-1'],
		minWidth: 72,
		height: '100%',
		paddingInline: spacingVars['--spacing-3'],
		boxSizing: 'border-box',
		margin: 0,
		borderWidth: 0,
		borderStyle: 'none',
		appearance: 'none',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		fontFamily: typographyVars['--font-family-body'],
		fontSize: typeScaleVars['--text-supporting-size'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		whiteSpace: 'nowrap'
	},
	swipeEntryDisabled: {
		opacity: 0.5
	}
});

// A verb's colour: ordinary, the one you mean, the dangerous one. The panel
// wears its outermost entry's, so a slide-out fills the row with it.
const swipeVariantStyles = stylex.create({
	neutral: {
		backgroundColor: colorVars['--color-neutral'],
		color: colorVars['--color-text-primary']
	},
	accent: {
		backgroundColor: colorVars['--color-accent'],
		color: colorVars['--color-on-accent']
	},
	destructive: {
		backgroundColor: colorVars['--color-error'],
		color: colorVars['--color-on-error'],
		// Forced colors replace the fill with Canvas; a border keeps the
		// destructive fill's shape visible (architecture:theme-tokens INV11). A
		// border, not an outline, leaves the shared focus ring intact.
		borderWidth: { default: 0, '@media (forced-colors: active)': '1px' },
		borderStyle: { default: 'none', '@media (forced-colors: active)': 'solid' },
		borderColor: {
			default: null,
			'@media (forced-colors: active)': 'CanvasText'
		}
	}
});

/**
 * A side's panel, wearing its outermost entry's colour so a slide-out fills the
 * row with it.
 */
export function itemSwipePanelAttrs(
	side: SwipeSide,
	variant: ItemSwipeActionVariant
): SvelteStyleAttrs {
	return sx(
		styles.swipePanel,
		side === 'leading' ? styles.swipePanelLeading : styles.swipePanelTrailing,
		swipeVariantStyles[variant]
	);
}

/** The entries at their natural width; the panel clips them to the travel. */
export function itemSwipeEntriesAttrs(side: SwipeSide): SvelteStyleAttrs {
	return sx(styles.swipeEntries, side === 'leading' && styles.swipeEntriesLeading);
}

/** One verb's surface, in its variant colour. */
export function itemSwipeEntryAttrs(
	variant: ItemSwipeActionVariant,
	isDisabled: boolean
): SvelteStyleAttrs {
	return sx(
		styles.swipeEntry,
		swipeVariantStyles[variant],
		isDisabled && styles.swipeEntryDisabled
	);
}

/** One verb's button surface plus the shared keyboard focus ring. */
export function itemSwipeEntryFocusAttrs(
	variant: ItemSwipeActionVariant,
	isDisabled: boolean
): SvelteStyleAttrs {
	return focusOutlineProps.focusVisible(
		styles.swipeEntry,
		swipeVariantStyles[variant],
		isDisabled && styles.swipeEntryDisabled
	);
}
