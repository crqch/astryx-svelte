import * as stylex from '@stylexjs/stylex';
import {
	layoutPaddingOuterXVarStyles,
	layoutPaddingOuterYVarStyles
} from '../../internal/padding.stylex.js';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import type { SizeValue, SpacingStep } from '../../internal/types.js';
import { stack } from '../stack/stack.stylex.js';
import { stackItem } from '../stack/stack-item.stylex.js';
import { layoutFooterMarker, layoutHeaderMarker } from './layout-edges.stylex.js';

/**
 * The four elements `Layout` renders, ported from Astryx's `Layout.tsx`.
 *
 * The outer/inner pair is the padding-escape trick: the outer wrapper cancels
 * the enclosing container's padding with negative margins, and the inner one
 * zeroes the container variables so descendants do not inherit padding that has
 * already been escaped.
 */

const styles = stylex.create({
	// Outer wrapper uses negative margin to escape container padding
	layoutOuter: {
		marginInlineStart: 'calc(-1 * var(--container-padding-inline-start, 0px))',
		marginInlineEnd: 'calc(-1 * var(--container-padding-inline-end, 0px))',
		marginBlockStart: 'calc(-1 * var(--container-padding-block-start, 0px))',
		marginBlockEnd: 'calc(-1 * var(--container-padding-block-end, 0px))'
	},
	// Inner wrapper resets container padding vars for descendants
	layoutInner: {
		'--container-padding-inline-start': '0px',
		'--container-padding-inline-end': '0px',
		'--container-padding-block-start': '0px',
		'--container-padding-block-end': '0px',
		// A Layout without contentWidth caps no region: `initial` makes every
		// var(--layout-content-width, none) fall back to none. The alignment width
		// is read only inside the middle row's query container, where 100cqi is
		// its own width. An explicit contentWidth overrides both on this node.
		'--layout-content-width': 'initial',
		'--layout-alignment-width': '100cqi',
		// A Layout's `padding` belongs to its own regions. Clear an ancestor
		// Layout's value so a nested Layout without `padding` takes the nearest
		// padding container's inset (Card, Section, Dialog) or the default,
		// instead of inheriting, e.g., AppShell's internal padding={0}. An
		// explicit `padding` on this Layout overrides this on the same node.
		'--layout-padding-own-outer-x': 'initial',
		'--layout-padding-own-outer-y': 'initial',
		'--_layout-flush-block-start': 'initial',
		'--_layout-flush-block-end': 'initial'
	},
	fill: {
		// Add 2x container block padding to compensate for negative block margins
		height:
			'calc(100% + var(--container-padding-block-start, 0px) + var(--container-padding-block-end, 0px))',
		maxHeight: 'var(--container-max-height, none)'
	},
	auto: {
		minHeight: '100%'
	},
	middle: {
		flex: 1,
		minHeight: 0,
		// A LayoutHeader without a divider right before this row, or a
		// LayoutFooter without one right after it, removes the matching inner
		// padding of LayoutContent (it reads these, falling back to its padding).
		// Sibling relations on this row only: a `:has()` on the layout followed
		// by `*` restyles everything inside it on any change. Unset otherwise:
		// the inner stack clears both values, so a nested Layout does not take an
		// outer row's collapse.
		'--_layout-flush-block-start': {
			default: null,
			[stylex.when.siblingBefore(':not([data-divider])', layoutHeaderMarker)]: '0px'
		},
		'--_layout-flush-block-end': {
			default: null,
			[stylex.when.siblingAfter(':not([data-divider])', layoutFooterMarker)]: '0px'
		}
	},
	middleQuery: {
		containerType: {
			default: null,
			':has(> div > .astryx-layout-content)': 'inline-size'
		}
	},
	// Without side panels, LayoutContent owns the full-width scrollport and
	// aligns its children internally. Arbitrary content keeps the existing
	// constrained-lane behavior.
	singleColumnContent: {
		width: '100%',
		maxWidth: {
			default: 'var(--layout-content-width, none)',
			':has(> .astryx-layout-content)': 'none'
		},
		marginInline: 'auto'
	},
	// With one side panel, keep that panel aligned to the content-width frame
	// while allowing LayoutContent to occupy the opposite open side.
	singlePanelMiddle: {
		boxSizing: 'border-box',
		width: '100%',
		maxWidth: {
			default: 'var(--layout-content-width, none)',
			':has(> div > .astryx-layout-content)': 'none'
		},
		marginInline: {
			default: 'auto',
			':has(> div > .astryx-layout-content)': 0
		}
	},
	singleStartPanel: {
		paddingInlineStart: {
			default: null,
			':has(> div > .astryx-layout-content)':
				'max(0px, calc((100% - var(--layout-content-width)) / 2))'
		}
	},
	singleEndPanel: {
		paddingInlineEnd: {
			default: null,
			':has(> div > .astryx-layout-content)':
				'max(0px, calc((100% - var(--layout-content-width)) / 2))'
		}
	},
	// When full bleed, set this Layout's outer padding to 0 so its regions touch
	// container edges
	fullBleed: {
		'--layout-padding-own-outer-x': '0px',
		'--layout-padding-own-outer-y': '0px'
	}
});

const dynamicStyles = stylex.create({
	contentWidthVar: (width: SizeValue) => ({
		'--layout-content-width': typeof width === 'number' ? `${width}px` : width
	}),
	contentAlignmentWidthVar: (width: SizeValue) => ({
		'--layout-alignment-width': typeof width === 'number' ? `${width}px` : width
	}),
	contentWidth: (width: SizeValue) => ({
		width: '100%',
		maxWidth: typeof width === 'number' ? `${width}px` : width,
		marginInline: 'auto'
	})
});

/** The root element: escapes the container's padding, and takes its height mode. */
export function layoutOuterAttrs(isFill: boolean, xstyle?: StyleArg): SvelteStyleAttrs {
	return sx(styles.layoutOuter, isFill ? styles.fill : styles.auto, xstyle);
}

export interface LayoutInnerOptions {
	isFill: boolean;
	padding?: SpacingStep;
	contentWidth?: SizeValue;
	usesInternalContentWidth: boolean;
}

/**
 * The vertical stack holding header, middle row and footer.
 *
 * It carries `stylex.defaultMarker()`, which is what the middle row's
 * `containerType` and the flush custom properties resolve against. An explicit
 * `padding` overrides the `own` value cleared here on the same node.
 */
export function layoutInnerAttrs({
	isFill,
	padding,
	contentWidth,
	usesInternalContentWidth
}: LayoutInnerOptions): SvelteStyleAttrs {
	return sx(
		stylex.defaultMarker(),
		styles.layoutInner,
		...stack({ direction: 'vertical' }),
		isFill ? styles.fill : styles.auto,
		padding === 0 && styles.fullBleed,
		padding != null && layoutPaddingOuterXVarStyles[padding],
		padding != null && layoutPaddingOuterYVarStyles[padding],
		contentWidth != null && dynamicStyles.contentWidthVar(contentWidth),
		usesInternalContentWidth &&
			contentWidth != null &&
			dynamicStyles.contentAlignmentWidthVar(contentWidth)
	);
}

export interface LayoutMiddleOptions {
	contentWidth?: SizeValue;
	usesInternalContentWidth: boolean;
	hasBothPanels: boolean;
	hasSinglePanel: boolean;
	hasStart: boolean;
	hasEnd: boolean;
}

/** The horizontal row: start panel, content, end panel. */
export function layoutMiddleAttrs({
	contentWidth,
	usesInternalContentWidth,
	hasBothPanels,
	hasSinglePanel,
	hasStart,
	hasEnd
}: LayoutMiddleOptions): SvelteStyleAttrs {
	return sx(
		...stack({ direction: 'horizontal' }),
		styles.middle,
		contentWidth != null &&
			(!usesInternalContentWidth || hasBothPanels) &&
			dynamicStyles.contentWidth(contentWidth),
		usesInternalContentWidth && !hasBothPanels && styles.middleQuery,
		usesInternalContentWidth && hasSinglePanel && styles.singlePanelMiddle,
		usesInternalContentWidth && hasStart && !hasEnd && styles.singleStartPanel,
		usesInternalContentWidth && !hasStart && hasEnd && styles.singleEndPanel
	);
}

export interface LayoutContentSlotOptions {
	usesInternalContentWidth: boolean;
	hasStart: boolean;
	hasEnd: boolean;
}

/** The flex item between the two panels, which the content slot fills. */
export function layoutContentSlotAttrs({
	usesInternalContentWidth,
	hasStart,
	hasEnd
}: LayoutContentSlotOptions): SvelteStyleAttrs {
	return sx(
		...stackItem({ size: 'fill' }),
		usesInternalContentWidth && !hasStart && !hasEnd && styles.singleColumnContent
	);
}
