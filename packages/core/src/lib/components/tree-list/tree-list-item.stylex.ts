import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	spacingVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';
import type { TreeListDensity } from './tree-list-types.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';
import { rowPressLayerStyles } from '../../private-attributes/press.stylex.js';
import { interactionOverlayStyles } from '../../utils/interaction-overlay.stylex.js';

/**
 * Ported from Astryx's `TreeList/TreeListItem.tsx` styles.
 *
 * Both modes. `wrapper`, `contentWrapper`/`focusLift`/`interactive`/`disabled`/
 * `selected` (a five-conditional merge with a dynamic density index) and
 * `description` (merged with a dynamic `descriptionSizeStyles[density]`)
 * survive as objects in upstream's `dist/`; everything else is applied alone at
 * one call site and folded into a literal class string.
 *
 * **0.2.0 deleted the `treeItemScope` marker.** Focus scoping used to run through
 * `when.ancestor(':focus-visible', treeItemScope)`, which needed a companion
 * `tree-list-item.markers.stylex.ts` whose class is path-derived and so could
 * never equal upstream's — those keys were diffed as marker-normalised CSS.
 * Upstream now publishes the row's own focus state as two inheritable custom
 * properties instead, and the marker module is gone from both sides. The nesting
 * guarantee is the reason it works: every nested `<li>` redeclares both vars with
 * a `default`, so a descendant row's default shadows an ancestor's active value
 * and the ring cannot leak past the nearest containing treeitem.
 */
const styles = stylex.create({
	wrapper: {
		listStyleType: 'none',
		margin: 0,
		padding: 0,
		position: 'relative',
		width: '100%',
		// Publish whether THIS treeitem has keyboard focus, for its row's
		// `zIndex` (see `focusLift`). Every nested <li> redeclares the
		// default, so a focused ancestor never lifts its descendants' rows.
		'--_tree-focus-z': {
			default: 'auto',
			':focus-visible': '2'
		},
		// The treeitem row is the roving-tabindex focus owner; suppress the
		// native focus ring in favor of the row's :focus-visible outline below.
		outline: 'none'
		// Publish this row's own focus state as an inheritable CSS variable
		// instead of matching it via an ancestor selector. Every nested <li>
		// redeclares these vars (default: 'none' / '0'), so a descendant row's
		// default shadows an ancestor's active value — the ring can never leak
		// past the nearest containing treeitem, however deep the tree nests.
		// That publication is `focusOutlineProps.publishFocusVisibleVars` at the
		// call site now, rather than two hand-rolled `--_tree-focus-*` vars.
	},
	childGroup: {
		margin: 0,
		padding: 0,
		listStyleType: 'none'
	},
	treeBranches: {
		paddingInlineStart: spacingVars['--spacing-2']
	},
	rowWrapper: {
		position: 'relative',
		// Inter-row gap. Half the public `--tree-list-row-gap` lever sits above and
		// half below the row box; because this is PADDING (not margin) it cannot
		// collapse, so adjacent rows end up a full gap apart — and it rides the
		// `rowWrapper`, which carries no theme target, so the paintable
		// `tree-list-item` stays a pure paint seam (layout lives off it). The `<li>`s
		// stay contiguous — the gap is padding INSIDE each `<li>`, not space between
		// them — so the per-`<li>` connector guide can still span it and read as a
		// continuous line (see `tree-list-branches`). The lever's default is a subtle
		// `--spacing-0-5` (2px, set on the tree-list root); a theme widens or closes
		// it via the `tree-list` target.
		paddingBlock: 'calc(var(--tree-list-row-gap, 0px) / 2)'
	},
	contentWrapper: {
		borderRadius: radiusVars['--radius-element'],
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-2'],
		// No `outline: 'none'` here: this element receives the shared focus ring,
		// which already defaults to none, and the shorthand would erase it.
		overflow: 'hidden',
		position: 'relative',
		boxSizing: 'border-box',
		textAlign: 'start'
	},
	// Guide lines draw above the rows (TreeListBranches) so a row's fill does
	// not break them. Lift the row whose focus ring is showing above the guides
	// too, so no guide cuts through the ring: when focus is inside the row, or
	// when its own treeitem publishes focus (`--_tree-focus-z` on `wrapper`).
	// The ring is the row's outline, so it cannot be lifted on its own: a
	// focused row that is also filled (selected or hovered) covers the guides at
	// that row. That is the accepted trade-off. Applied only with
	// `focusWithinOrPublished`, the rows that draw the ring: a plain row shows
	// no ring, so its fill stays under the guides.
	focusLift: {
		zIndex: {
			default: 'var(--_tree-focus-z, auto)',
			':has(:focus-visible)': 2
		}
	},
	// Per-level indent, drawn INSIDE the row box: the row (`contentWrapper`)
	// stays full width, so a nested row's hover and selected fill spans the
	// list like a root row's, while its content sits exactly where a margin
	// indent would put it. A child of the row rather than the row's own padding,
	// so a theme or caller that sets the row's padding keeps the indent. It
	// inherits the row's flex alignment and gap, so a theme that retunes those
	// on `tree-list-item` still lays the content out. The row publishes only the
	// computed distance as `--_tree-indent`; the per-level step is the public,
	// themeable `--tree-list-indent` lever (see TreeList `root`).
	indentedContent: {
		display: 'flex',
		flex: 1,
		minWidth: 0,
		alignItems: 'inherit',
		gap: 'inherit',
		paddingInlineStart: 'var(--_tree-indent, 0px)'
	},
	interactive: {
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		transitionProperty: 'background-image',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	disabled: {
		cursor: 'default',
		opacity: 0.5,
		pointerEvents: 'none' as const
	},
	selected: {
		backgroundColor: colorVars['--color-accent-muted']
	},
	invisibleButton: {
		all: 'unset',
		cursor: {
			default: 'inherit',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		font: 'inherit',
		color: 'inherit',
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0,
		textAlign: 'start',
		// Suppress inner focus ring — the parent <li> handles it via :has(:focus-visible)
		outline: 'none'
	},
	invisibleAnchor: {
		all: 'unset',
		cursor: {
			default: 'inherit',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		font: 'inherit',
		color: 'inherit',
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0,
		textAlign: 'start',
		textDecoration: 'none',
		// Suppress inner focus ring — the parent <li> handles it via :has(:focus-visible)
		outline: 'none'
	},
	content: {
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0,
		textAlign: 'start'
	},
	label: {
		color: colorVars['--color-text-primary']
	},
	description: {
		color: colorVars['--color-text-secondary']
	},
	startContent: {
		flexShrink: 0,
		display: 'flex',
		alignItems: 'center'
	},
	endContent: {
		flexShrink: 0,
		display: 'flex',
		alignItems: 'center',
		marginInlineStart: 'auto'
	},
	chevronContainer: {
		flexShrink: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: spacingVars['--spacing-4'],
		height: spacingVars['--spacing-4'],
		fontSize: spacingVars['--spacing-4'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		padding: 0,
		color: colorVars['--color-icon-secondary'],
		borderRadius: radiusVars['--radius-inner']
	},
	chevronButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: spacingVars['--spacing-4'],
		height: spacingVars['--spacing-4'],
		fontSize: spacingVars['--spacing-4'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		color: colorVars['--color-icon-secondary'],
		borderRadius: radiusVars['--radius-inner']
	},
	chevronSvg: {
		display: 'flex',
		// The chevron column is sized in spacing tokens by the button/container
		// around it (--spacing-4 = 16px), not on Icon's rem scale, so the glyph's
		// box is pinned to that same token. Icon's `sm` (1rem) only coincides with
		// 16px at a 16px root font-size; drifting off the token would knock the
		// glyph out of its 16px column.
		width: spacingVars['--spacing-4'],
		height: spacingVars['--spacing-4'],
		fontSize: spacingVars['--spacing-4'],
		transitionProperty: 'transform',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	// The RTL mirror is folded into each state's transform rather than living on
	// a parent span. Both are `transform`, so on one element the later value
	// would win — spelling out `scaleX(-1) rotate(...)` per state composes them
	// exactly as the nested elements did, while leaving a single element to
	// carry the glyph's theme target.
	chevronExpanded: {
		transform: {
			default: 'rotate(90deg)',
			':is([dir="rtl"] *)': 'scaleX(-1) rotate(90deg)'
		}
	},
	chevronCollapsed: {
		transform: {
			default: 'rotate(0deg)',
			':is([dir="rtl"] *)': 'scaleX(-1) rotate(0deg)'
		}
	}
});

const densityStyles = stylex.create({
	compact: {
		paddingBlock: spacingVars['--spacing-1'],
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading']
	},
	balanced: {
		paddingBlock: spacingVars['--spacing-2'],
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading']
	},
	spacious: {
		paddingBlock: spacingVars['--spacing-3'],
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading']
	}
});

const descriptionSizeStyles = stylex.create({
	compact: {
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading']
	},
	balanced: {
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading']
	},
	spacious: {
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading']
	}
});

/** The `<li role="treeitem">`, publishing its own focus state as custom properties. */
export function treeItemWrapperAttrs(): SvelteStyleAttrs {
	return focusOutlineProps.publishFocusVisibleVars(styles.wrapper);
}

/** The `<ul role="group">` holding an expanded item's children. */
export function treeItemChildGroupAttrs(): SvelteStyleAttrs {
	return sx(styles.childGroup);
}

/** The inset box the connector columns are positioned within. */
export function treeItemBranchesAttrs(): SvelteStyleAttrs {
	return sx(styles.treeBranches);
}

/** The positioning context for the row. */
export function treeItemRowWrapperAttrs(): SvelteStyleAttrs {
	return sx(styles.rowWrapper);
}

/**
 * The row itself — hover/press, focus ring, disabled dim and selection.
 *
 * `hasInteractiveStyles` is upstream's `isInteractive || (hasChildren && onClick
 * == null)`: a parent whose only action is expand/collapse still gets the
 * pointer affordance and the focus ring.
 */
export function treeItemContentWrapperAttrs(
	density: TreeListDensity,
	hasInteractiveStyles: boolean,
	isDisabled: boolean,
	isSelected: boolean,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	if (!hasInteractiveStyles) {
		return sx(
			styles.contentWrapper,
			densityStyles[density],
			isDisabled && styles.disabled,
			isSelected && styles.selected,
			xstyle
		);
	}
	// `focusWithinOrPublished` sits FIRST, as upstream's does, and carries
	// `focusLift`: a plain row draws no ring and keeps its fill under the guides,
	// while a ringed row lifts above them.
	return focusOutlineProps.focusWithinOrPublished(
		styles.contentWrapper,
		styles.focusLift,
		densityStyles[density],
		styles.interactive,
		// Upstream 0.5.1 moved the hover/pressed overlay into the shared module.
		interactionOverlayStyles.backgroundImage,
		// The touch press on a compositor layer (after the overlay, whose own
		// touch paint it turns off).
		rowPressLayerStyles.cell,
		rowPressLayerStyles.cellOnImage,
		isDisabled && styles.disabled,
		isSelected && styles.selected,
		xstyle
	);
}

/** The per-level indent wrapper inside the row. */
export function treeItemIndentedContentAttrs(): SvelteStyleAttrs {
	return sx(styles.indentedContent);
}

/** The invisible `<button>` an `onClick` item renders. */
export function treeItemInvisibleButtonAttrs(): SvelteStyleAttrs {
	return sx(styles.invisibleButton);
}

/** The invisible `<a>` an `href` item renders. */
export function treeItemInvisibleAnchorAttrs(): SvelteStyleAttrs {
	return sx(styles.invisibleAnchor);
}

/** The label/description column of a static (non-interactive) item. */
export function treeItemContentAttrs(): SvelteStyleAttrs {
	return sx(styles.content);
}

/** The label line. */
export function treeItemLabelAttrs(): SvelteStyleAttrs {
	return sx(styles.label);
}

/** The description line, sized by density. */
export function treeItemDescriptionAttrs(density: TreeListDensity): SvelteStyleAttrs {
	return sx(styles.description, descriptionSizeStyles[density]);
}

/** The leading slot. */
export function treeItemStartContentAttrs(): SvelteStyleAttrs {
	return sx(styles.startContent);
}

/** The trailing slot, pushed to the end. */
export function treeItemEndContentAttrs(): SvelteStyleAttrs {
	return sx(styles.endContent);
}

/** The inert chevron shown when expansion is not wired up. */
export function treeItemChevronContainerAttrs(): SvelteStyleAttrs {
	return sx(styles.chevronContainer);
}

/** The real chevron toggle `<button>`. */
export function treeItemChevronButtonAttrs(): SvelteStyleAttrs {
	return sx(styles.chevronButton);
}

/**
 * The rotating chevron glyph, passed to the `Icon`'s `xstyle` (#4838). `Icon`
 * renders the glyph's span itself — carrying the pre-existing `astryx-icon`
 * target — so the rotation rides that element instead of two extra wrappers,
 * and the RTL mirror is spelled out per state above rather than nested outside.
 */
export const treeItemChevronSvgStyle = styles.chevronSvg;
export const treeItemChevronExpandedStyle = styles.chevronExpanded;
export const treeItemChevronCollapsedStyle = styles.chevronCollapsed;
