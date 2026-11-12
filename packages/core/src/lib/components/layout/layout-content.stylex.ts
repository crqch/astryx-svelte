import * as stylex from '@stylexjs/stylex';
import {
	containerPaddingBlockEndVarStyles,
	containerPaddingBlockStartVarStyles,
	containerPaddingInlineVarStyles,
	paddingStyles
} from '../../internal/padding.stylex.js';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import type { SpacingStep } from '../../internal/types.js';
import { spacingVars } from '../../styles/tokens.stylex.js';
import type { LayoutSlots } from './layout-slots-context.svelte.js';

/**
 * `LayoutContent`'s styles, ported from Astryx's `LayoutContent.tsx`.
 *
 * The padding model in one line: an edge that touches the container takes the
 * *outer* padding, an edge that abuts another slot takes the *inner* one — and
 * when the neighbouring header or footer has no divider, the middle row sets a
 * flush variable to zero and that inner padding collapses so the two surfaces
 * read as one.
 *
 * The collapse is pure CSS: `Layout`'s middle row matches a sibling header or
 * footer without `data-divider` through its edge markers. No JS learns the
 * answer, which is why the collapse also works for a header the caller
 * rendered themselves.
 */

const styles = stylex.create({
	content: {
		boxSizing: 'border-box',
		height: '100%',
		flex: 1,
		minHeight: 0,
		overflow: 'clip',
		// Default: inner padding on all sides (will be overridden by position-specific styles)
		paddingInlineStart: `var(--layout-padding-inner-x, ${spacingVars['--spacing-4']})`,
		paddingInlineEnd: `var(--layout-padding-inner-x, ${spacingVars['--spacing-4']})`,
		// A header or footer without a divider collapses the adjacent padding for
		// a seamless visual flow: Layout's middle row sets these to 0px then.
		paddingBlockStart: `var(--_layout-flush-block-start, var(--layout-padding-inner-y, ${spacingVars['--spacing-4']}))`,
		paddingBlockEnd: `var(--_layout-flush-block-end, var(--layout-padding-inner-y, ${spacingVars['--spacing-4']}))`,
		// Publish container padding vars for bleed children (Table, Divider, etc.)
		'--container-padding-inline-start': `var(--layout-padding-inner-x, ${spacingVars['--spacing-4']})`,
		'--container-padding-inline-end': `var(--layout-padding-inner-x, ${spacingVars['--spacing-4']})`,
		'--container-padding-block-start': `var(--_layout-flush-block-start, var(--layout-padding-inner-y, ${spacingVars['--spacing-4']}))`,
		'--container-padding-block-end': `var(--_layout-flush-block-end, var(--layout-padding-inner-y, ${spacingVars['--spacing-4']}))`
	},
	// When no start panel: outer-x on left edge
	noStart: {
		paddingInlineStart: `var(--layout-padding-own-outer-x, var(--layout-padding-outer-x, ${spacingVars['--spacing-4']}))`,
		'--container-padding-inline-start': `var(--layout-padding-own-outer-x, var(--layout-padding-outer-x, ${spacingVars['--spacing-4']}))`
	},
	// When no end panel: outer-x on right edge
	noEnd: {
		paddingInlineEnd: `var(--layout-padding-own-outer-x, var(--layout-padding-outer-x, ${spacingVars['--spacing-4']}))`,
		'--container-padding-inline-end': `var(--layout-padding-own-outer-x, var(--layout-padding-outer-x, ${spacingVars['--spacing-4']}))`
	},
	// When no header: outer-y on top
	noHeader: {
		paddingBlockStart: `var(--layout-padding-own-outer-y, var(--layout-padding-outer-y, ${spacingVars['--spacing-4']}))`,
		'--container-padding-block-start': `var(--layout-padding-own-outer-y, var(--layout-padding-outer-y, ${spacingVars['--spacing-4']}))`
	},
	// When no footer: outer-y on bottom
	noFooter: {
		paddingBlockEnd: `var(--layout-padding-own-outer-y, var(--layout-padding-outer-y, ${spacingVars['--spacing-4']}))`,
		'--container-padding-block-end': `var(--layout-padding-own-outer-y, var(--layout-padding-outer-y, ${spacingVars['--spacing-4']}))`
	},
	scrollable: {
		overflow: 'auto'
	},
	// Keep LayoutContent as the scroll and padding owner. These styles only add
	// the gutter needed to align its direct children to contentWidth.
	constrainedNoPanelsStart: {
		paddingInlineStart:
			'max(var(--container-padding-inline-start, 0px), calc((100cqi - var(--layout-alignment-width)) / 2 + var(--container-padding-inline-start, 0px)))'
	},
	constrainedNoPanelsEnd: {
		paddingInlineEnd:
			'max(var(--container-padding-inline-end, 0px), calc((100cqi - var(--layout-alignment-width)) / 2 + var(--container-padding-inline-end, 0px)))'
	},
	// A one-panel middle query box excludes the panel-side centered gutter, so
	// its full difference from contentWidth is the missing opposite-side gutter.
	constrainedSingleStartPanel: {
		paddingInlineEnd:
			'max(var(--container-padding-inline-end, 0px), calc(100cqi - var(--layout-alignment-width) + var(--container-padding-inline-end, 0px)))'
	},
	constrainedSingleEndPanel: {
		paddingInlineStart:
			'max(var(--container-padding-inline-start, 0px), calc(100cqi - var(--layout-alignment-width) + var(--container-padding-inline-start, 0px)))'
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
	}
});

export interface LayoutContentAttrsOptions {
	slots: LayoutSlots;
	isScrollable: boolean;
	padding?: SpacingStep;
}

export function layoutContentAttrs(
	{
		slots: { hasHeader, hasFooter, hasStart, hasEnd },
		isScrollable,
		padding
	}: LayoutContentAttrsOptions,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	const isZeroPadding = padding === 0;

	return sx(
		styles.content,
		// Outer padding on container edges (unless content is full bleed)
		!hasStart && !isZeroPadding && padding == null && styles.noStart,
		!hasEnd && !isZeroPadding && padding == null && styles.noEnd,
		!hasHeader && !isZeroPadding && padding == null && styles.noHeader,
		!hasFooter && !isZeroPadding && padding == null && styles.noFooter,
		isScrollable && styles.scrollable,
		isZeroPadding && styles.fullBleed,
		padding != null && paddingStyles[padding],
		padding != null && containerPaddingInlineVarStyles[padding],
		padding != null && containerPaddingBlockStartVarStyles[padding],
		padding != null && containerPaddingBlockEndVarStyles[padding],
		!hasStart && !hasEnd && !isZeroPadding && styles.constrainedNoPanelsStart,
		!hasStart && !hasEnd && !isZeroPadding && styles.constrainedNoPanelsEnd,
		hasStart && !hasEnd && !isZeroPadding && styles.constrainedSingleStartPanel,
		!hasStart && hasEnd && !isZeroPadding && styles.constrainedSingleEndPanel,
		xstyle
	);
}
