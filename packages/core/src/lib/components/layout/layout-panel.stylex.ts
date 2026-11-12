import * as stylex from '@stylexjs/stylex';
import {
	containerPaddingBlockEndVarStyles,
	containerPaddingBlockStartVarStyles,
	containerPaddingInlineVarStyles,
	paddingStyles
} from '../../internal/padding.stylex.js';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import type { SizeValue, SpacingStep } from '../../internal/types.js';
import { colorVars, spacingVars } from '../../styles/tokens.stylex.js';
import type { LayoutArea } from './layout-area-context.svelte.js';
import type { LayoutSlots } from './layout-slots-context.svelte.js';

/**
 * `LayoutPanel`'s styles, ported from Astryx's `LayoutPanel.tsx`.
 *
 * Which edge the divider sits on is decided by the slot the panel is in, not by
 * a prop: a start panel draws on its end edge and an end panel on its start
 * edge, so both face the content. With no divider the same edge collapses by a
 * negative margin instead, which is what merges the panel into the content.
 */

const styles = stylex.create({
	panel: {
		boxSizing: 'border-box',
		flexShrink: 0,
		overflow: 'clip',
		// Default: inner padding on all sides (will be overridden by position-specific styles)
		paddingInlineStart: `var(--layout-padding-inner-x, ${spacingVars['--spacing-4']})`,
		paddingInlineEnd: `var(--layout-padding-inner-x, ${spacingVars['--spacing-4']})`,
		paddingBlockStart: `var(--layout-padding-inner-y, ${spacingVars['--spacing-4']})`,
		paddingBlockEnd: `var(--layout-padding-inner-y, ${spacingVars['--spacing-4']})`,
		'--container-padding-inline-start': `var(--layout-padding-inner-x, ${spacingVars['--spacing-4']})`,
		'--container-padding-inline-end': `var(--layout-padding-inner-x, ${spacingVars['--spacing-4']})`,
		'--container-padding-block-start': `var(--layout-padding-inner-y, ${spacingVars['--spacing-4']})`,
		'--container-padding-block-end': `var(--layout-padding-inner-y, ${spacingVars['--spacing-4']})`
	},
	// An edge on the Layout's boundary takes the Layout-edge inset. Each edge
	// publishes the padding it applies, so full-bleed children line up with it.
	startPanel: {
		paddingInlineStart: `var(--layout-padding-own-outer-x, var(--layout-padding-outer-x, ${spacingVars['--spacing-4']}))`,
		'--container-padding-inline-start': `var(--layout-padding-own-outer-x, var(--layout-padding-outer-x, ${spacingVars['--spacing-4']}))`
	},
	endPanel: {
		paddingInlineEnd: `var(--layout-padding-own-outer-x, var(--layout-padding-outer-x, ${spacingVars['--spacing-4']}))`,
		'--container-padding-inline-end': `var(--layout-padding-own-outer-x, var(--layout-padding-outer-x, ${spacingVars['--spacing-4']}))`
	},
	noHeader: {
		paddingBlockStart: `var(--layout-padding-own-outer-y, var(--layout-padding-outer-y, ${spacingVars['--spacing-4']}))`,
		'--container-padding-block-start': `var(--layout-padding-own-outer-y, var(--layout-padding-outer-y, ${spacingVars['--spacing-4']}))`
	},
	noFooter: {
		paddingBlockEnd: `var(--layout-padding-own-outer-y, var(--layout-padding-outer-y, ${spacingVars['--spacing-4']}))`,
		'--container-padding-block-end': `var(--layout-padding-own-outer-y, var(--layout-padding-outer-y, ${spacingVars['--spacing-4']}))`
	},
	fullBleed: {
		paddingInlineStart: 0,
		paddingInlineEnd: 0,
		paddingBlockStart: 0,
		paddingBlockEnd: 0,
		'--container-padding-inline-start': '0px',
		'--container-padding-inline-end': '0px',
		'--container-padding-block-start': '0px',
		'--container-padding-block-end': '0px'
	},
	scrollable: {
		overflow: 'auto'
	},
	// At width 0 the padding box is 0 too, so the clip hides every child.
	zeroWidth: {
		paddingInlineStart: 0,
		paddingInlineEnd: 0,
		overflow: 'clip'
	},
	// For start panel: divider on end edge
	dividerEnd: {
		borderInlineEndWidth: 1,
		borderInlineEndStyle: 'solid',
		borderInlineEndColor: colorVars['--color-border']
	},
	// For end panel: divider on start edge
	dividerStart: {
		borderInlineStartWidth: 1,
		borderInlineStartStyle: 'solid',
		borderInlineStartColor: colorVars['--color-border']
	},
	// When no divider, collapse spacing on the side facing content
	// Start panel: collapse end (right in LTR) to merge with content
	// End panel: collapse start (left in LTR) to merge with content
	collapseStart: {
		marginInlineStart: `calc(-1 * var(--layout-padding-inner-x, ${spacingVars['--spacing-4']}))`
	},
	collapseEnd: {
		marginInlineEnd: `calc(-1 * var(--layout-padding-inner-x, ${spacingVars['--spacing-4']}))`
	}
});

const dynamicStyles = stylex.create({
	sizing: (width: SizeValue | null) => ({
		width
	})
});

export interface LayoutPanelAttrsOptions {
	area: LayoutArea;
	slots: LayoutSlots;
	hasDivider: boolean;
	isScrollable: boolean;
	padding?: SpacingStep;
	width?: SizeValue;
	isZeroWidth: boolean;
}

export function layoutPanelAttrs(
	{
		area,
		slots: { hasHeader, hasFooter },
		hasDivider,
		isScrollable,
		padding,
		width,
		isZeroWidth
	}: LayoutPanelAttrsOptions,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	const isStartPanel = area === 'start';
	const isEndPanel = area === 'end';

	const isZeroPadding = padding === 0;

	// When no divider, collapse spacing for seamless visual flow
	const shouldCollapseSpacing = !hasDivider && !isZeroPadding && padding == null && !isZeroWidth;

	// Select divider style based on position
	const dividerStyle = isStartPanel ? styles.dividerEnd : isEndPanel ? styles.dividerStart : null;

	// Select collapse style based on position (collapse the side where divider would be)
	const collapseStyle = isStartPanel
		? styles.collapseEnd
		: isEndPanel
			? styles.collapseStart
			: null;

	return sx(
		styles.panel,
		dynamicStyles.sizing(width ?? null),
		// Outer padding on container edges (unless component is full bleed)
		isStartPanel && !isZeroPadding && padding == null && styles.startPanel,
		isEndPanel && !isZeroPadding && padding == null && styles.endPanel,
		!hasHeader && !isZeroPadding && padding == null && styles.noHeader,
		!hasFooter && !isZeroPadding && padding == null && styles.noFooter,
		isScrollable && styles.scrollable,
		isZeroPadding && styles.fullBleed,
		padding != null && paddingStyles[padding],
		padding != null && containerPaddingInlineVarStyles[padding],
		padding != null && containerPaddingBlockStartVarStyles[padding],
		padding != null && containerPaddingBlockEndVarStyles[padding],
		hasDivider && dividerStyle,
		shouldCollapseSpacing && collapseStyle,
		isZeroWidth && styles.zeroWidth,
		xstyle
	);
}
