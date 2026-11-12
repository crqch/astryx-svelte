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
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { interactionOverlayStyles } from '../../utils/interaction-overlay.stylex.js';
import { rowPressLayerStyles } from '../../private-attributes/press.stylex.js';

/** The travel a drag writes on the row root, in physical px (see use-swipe-action). */
const SWIPE_TRAVEL = 'var(--_item-swipe-travel, 0px)';
/** The settle clock, `0s` while the finger drives the row. */
const SWIPE_DURATION = 'var(--_item-swipe-duration, 0s)';

/**
 * Ported from Astryx's `Item/Item.tsx`.
 *
 * The universal "start content + label + description + end content" row. The
 * interactive variants do not overlay an absolutely-positioned hit target —
 * the label/description column *is* the button or anchor (`flex: 1`, `all:
 * unset`), sitting inline between the marker/start content and the end content,
 * with the row's `:has(:focus-visible)` outline painting when it takes focus.
 */

const styles = stylex.create({
	root: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-2'],
		// The inline inset is published as --_item-inset-inline and the padding
		// derives from it, so consumers that need to compensate for the inset
		// (List's edge treatments) read the var instead of mirroring the values.
		'--_item-inset-inline': spacingVars['--spacing-2'],
		paddingInline: 'var(--_item-inset-inline)',
		position: 'relative',
		boxSizing: 'border-box',
		textAlign: 'start',
		borderRadius: radiusVars['--radius-element']
	},
	// One content cell beside the marker. Its slots retain the row's flex
	// alignment and gap, including first-line alignment and tall start content.
	// A numbered List can then subgrid the row into marker/content columns.
	markerContent: {
		display: 'flex',
		flex: 1,
		minWidth: 0,
		alignItems: 'inherit',
		alignSelf: 'stretch',
		gap: 'inherit'
	},
	markerContentFirstLine: {
		// A tall start/end slot moves the first text baseline down. The marker
		// must follow that baseline, not the stretched group's top edge.
		alignSelf: 'baseline'
	},
	alignStart: {
		alignItems: 'flex-start'
	},
	// `first-line`: the row aligns its children on their first baselines. The
	// label's first baseline is its first line's; each slot gets the same
	// baseline from its strut (below), which the slot centers against its
	// content. So each slot's center lands on the first line's center for any
	// slot height, and a taller slot pushes the text down instead of leaving
	// the row. Pure CSS: no measurement.
	alignFirstLine: {
		alignItems: 'baseline'
	},
	// A zero-width line of label text inside the slot: same size and leading as
	// the label, so its line box is the label's first line box. The slot centers
	// it against the slot's content, and the row's baseline alignment puts it on
	// the label's first line. Its content carries empty alternative text so
	// assistive technology reads nothing from it.
	firstLineSlot: {
		alignItems: 'center',
		'::before': {
			content: stylex.firstThatWorks('"\\200B" / ""', '"\\200B"'),
			inlineSize: 0,
			overflow: 'hidden',
			fontSize: typeScaleVars['--text-body-size'],
			lineHeight: typeScaleVars['--text-body-leading']
		}
	},
	interactive: {
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		transitionProperty: 'background-color',
		transitionDuration: durationVars['--duration-fast-min'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	highlighted: {
		backgroundColor: colorVars['--color-overlay-hover']
	},
	selected: {
		backgroundColor: colorVars['--color-accent-muted']
	},
	disabled: {
		cursor: 'default',
		pointerEvents: 'none'
	},
	// A row whose root is the link: the browser's anchor paint stays out of it.
	linkRoot: {
		color: 'inherit',
		textDecoration: 'none'
	},
	disabledContent: {
		opacity: 0.5
	},
	invisibleButton: {
		cursor: {
			default: 'inherit',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		color: 'inherit',
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0,
		textAlign: 'start',
		outline: 'none'
	},
	invisibleAnchor: {
		cursor: {
			default: 'inherit',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		color: 'inherit',
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0,
		textAlign: 'start',
		textDecoration: 'none',
		outline: 'none'
	},
	content: {
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0,
		textAlign: 'start'
	},
	// `layout="inline"`: label and description share one line, so the row fits a
	// fixed-height host such as a Selector trigger inside an InputGroup.
	inlineContent: {
		flexDirection: 'row',
		// Centered, not baseline-aligned: two different font sizes on a shared
		// baseline make a line box taller than either line, which would push a
		// fixed-height host (a Selector trigger) a pixel off its size token.
		alignItems: 'center',
		columnGap: spacingVars['--spacing-1']
	},
	inlineLabel: {
		flexShrink: 0
	},
	// The description yields width first, so the label — the part that identifies
	// the item — is the last thing to ellipsize.
	inlineDescription: {
		flexShrink: 1,
		minWidth: 0
	},
	label: {
		// Falls back to the primary text token; a parent (e.g. a destructive menu
		// item) can recolor the label by setting --_item-label-color.
		color: `var(--_item-label-color, ${colorVars['--color-text-primary']})`,
		fontSize: typeScaleVars['--text-body-size'],
		lineHeight: typeScaleVars['--text-body-leading']
	},
	labelSingleTruncate: {
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	},
	labelMultiTruncate: {
		overflow: 'hidden',
		display: '-webkit-box',
		WebkitBoxOrient: 'vertical'
	},
	description: {
		// Companion to --_item-label-color for the secondary line.
		color: `var(--_item-description-color, ${colorVars['--color-text-secondary']})`,
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: typeScaleVars['--text-supporting-leading']
	},
	descriptionSingleTruncate: {
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	},
	descriptionMultiTruncate: {
		overflow: 'hidden',
		display: '-webkit-box',
		WebkitBoxOrient: 'vertical'
	},
	startContent: {
		flex: '0 0 auto',
		display: 'flex'
	},
	endContent: {
		flex: '0 0 auto',
		display: 'flex',
		marginInlineStart: 'auto'
	},
	// Swipe actions. The root translates by the drag's travel and settles on
	// the clock the gesture writes; `pan-y` lets the browser keep scrolling the
	// list while the row owns horizontal movement, and `pinch-zoom` leaves a
	// two-finger pinch that starts on the row to the browser, so the page stays
	// zoomable (WCAG 1.4.4). The hover transition keeps its own clock beside
	// the transform's.
	swipeRoot: {
		touchAction: 'pan-y pinch-zoom',
		transform: `translate3d(${SWIPE_TRAVEL}, 0, 0)`,
		transitionProperty: 'background-color, transform',
		transitionDuration: `${durationVars['--duration-fast-min']}, ${SWIPE_DURATION}`,
		transitionTimingFunction: `${easeVars['--ease-standard']}, ease-out`
	}
});

const dynamicStyles = stylex.create({
	lineClamp: (lines: number) => ({
		WebkitLineClamp: lines
	})
});

const densityStyles = stylex.create({
	compact: {
		paddingBlock: spacingVars['--spacing-1']
	},
	balanced: {
		paddingBlock: spacingVars['--spacing-2']
	},
	spacious: {
		paddingBlock: spacingVars['--spacing-3'],
		'--_item-inset-inline': spacingVars['--spacing-3']
	}
});

export type ItemAlign = 'center' | 'start' | 'first-line';
export type ItemLayout = 'stacked' | 'inline';
export type ItemDensity = keyof typeof densityStyles;

/** Flags that pick the root's conditional styles. */
export interface ItemRootFlags {
	isInteractive: boolean;
	isHighlighted: boolean;
	isSelected: boolean;
	isDisabled: boolean;
	/** A state fill (highlighted or selected) is already the row's background. */
	hasStateFill: boolean;
	/** A caller-provided `role` means a parent handles keyboard — skip the disabled dim. */
	hasParentRole: boolean;
	/** The caller's root component is itself the link, so the anchor paint is reset. */
	isLinkRoot: boolean;
	/** The row serves swipe actions, so it translates and is a stacking context. */
	hasSwipe: boolean;
}

/** The item row. */
export function itemRootAttrs(
	density: ItemDensity,
	align: ItemAlign,
	{
		isInteractive,
		isHighlighted,
		isSelected,
		isDisabled,
		hasStateFill,
		hasParentRole,
		isLinkRoot,
		hasSwipe
	}: ItemRootFlags,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.root,
		densityStyles[density],
		align === 'start' && styles.alignStart,
		align === 'first-line' && styles.alignFirstLine,
		isInteractive && styles.interactive,
		// Upstream 0.5.1: hover/pressed background moved to the shared module. A
		// row with a state fill keeps the fill as its background colour, so its
		// overlay paints as an image layer over the fill.
		isInteractive &&
			(hasStateFill
				? interactionOverlayStyles.backgroundImage
				: interactionOverlayStyles.backgroundColor),
		// The touch press on a compositor layer (after the overlay, whose own
		// touch paint it turns off): the release keeps fading while script runs.
		isInteractive && rowPressLayerStyles.cell,
		// A highlighted row's fill is already the hover tone, so it shows only
		// its press. A selected row also shows its hover.
		isInteractive &&
			hasStateFill &&
			(isSelected ? rowPressLayerStyles.cellOnImage : rowPressLayerStyles.cellOnImagePressOnly),
		isInteractive && focusOutlineStyles.focusWithin,
		isLinkRoot && styles.linkRoot,
		isHighlighted && styles.highlighted,
		isSelected && styles.selected,
		isDisabled && !hasParentRole && styles.disabled,
		hasSwipe && styles.swipeRoot,
		xstyle
	);
}

function truncateStyle(
	lines: number | undefined,
	isString: boolean,
	single: StyleArg,
	multi: StyleArg
): StyleArg {
	if (lines != null) {
		return lines === 1 ? single : multi;
	}
	return isString ? single : null;
}

/** The label line, with truncation driven by `labelLines` or a string label. */
export function itemLabelAttrs(
	labelLines: number | undefined,
	isString: boolean,
	isInline: boolean
): SvelteStyleAttrs {
	return sx(
		styles.label,
		isInline && styles.inlineLabel,
		truncateStyle(labelLines, isString, styles.labelSingleTruncate, styles.labelMultiTruncate),
		labelLines != null && labelLines > 1 && dynamicStyles.lineClamp(labelLines)
	);
}

/**
 * The description line, same truncation rules — except that an inline row is one
 * line by definition, so the description always ellipsizes there. A snippet
 * description cannot wrap the row open.
 */
export function itemDescriptionAttrs(
	descriptionLines: number | undefined,
	isString: boolean,
	isInline: boolean
): SvelteStyleAttrs {
	return sx(
		styles.description,
		isInline && styles.inlineDescription,
		truncateStyle(
			descriptionLines,
			isString || isInline,
			styles.descriptionSingleTruncate,
			styles.descriptionMultiTruncate
		),
		descriptionLines != null && descriptionLines > 1 && dynamicStyles.lineClamp(descriptionLines)
	);
}

/** The middle column when the item is static or has a parent role. */
export function itemContentAttrs(isDisabled: boolean, isInline: boolean): SvelteStyleAttrs {
	return sx(styles.content, isInline && styles.inlineContent, isDisabled && styles.disabledContent);
}

/** The invisible `<button>` filling the middle column. */
export function itemInvisibleButtonAttrs(isDisabled: boolean, isInline: boolean): SvelteStyleAttrs {
	return sx(
		styles.invisibleButton,
		isInline && styles.inlineContent,
		isDisabled && styles.disabledContent
	);
}

/** The invisible link filling the middle column. */
export function itemInvisibleAnchorAttrs(isDisabled: boolean, isInline: boolean): SvelteStyleAttrs {
	return sx(
		styles.invisibleAnchor,
		isInline && styles.inlineContent,
		isDisabled && styles.disabledContent
	);
}

/** The leading slot wrapper. */
export function itemStartContentAttrs(align: ItemAlign): SvelteStyleAttrs {
	return sx(styles.startContent, align === 'first-line' && styles.firstLineSlot);
}

/**
 * The wrapper holding every content slot beside a numbered List row's marker,
 * so the row can subgrid into the List's marker/content columns.
 */
export function itemMarkerContentAttrs(align: ItemAlign): SvelteStyleAttrs {
	return sx(styles.markerContent, align === 'first-line' && styles.markerContentFirstLine);
}

/** The trailing slot wrapper. */
export function itemEndContentAttrs(isDisabled: boolean, align: ItemAlign): SvelteStyleAttrs {
	return sx(
		styles.endContent,
		align === 'first-line' && styles.firstLineSlot,
		isDisabled && styles.disabledContent
	);
}
