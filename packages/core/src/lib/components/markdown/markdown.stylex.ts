import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	borderVars,
	colorVars,
	durationVars,
	easeVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';
import type { BlockNode } from './parser.js';
import { headingLinksHeadingStyle } from './plugins/heading-links.stylex.js';

/**
 * Ported from the styles declared in Astryx's `Markdown/Markdown.tsx`.
 *
 * Group names are upstream's (`styles`, `dynamicStyles`, `cellAlignStyles`,
 * `streamingStyles`) so the class oracle needs no renames.
 */

const ALIGN_MARGIN: Record<string, string> = {
	start: '0',
	center: 'auto'
};

const BLOCK_ALIGN_MARGIN: Record<string, string | null> = {
	start: null,
	center: 'auto'
};

const dynamicStyles = stylex.create({
	proseWidth: (maxWidth: string) => ({
		maxWidth
	}),
	proseAlign: (marginInline: string) => ({
		marginInline
	}),
	blockWidth: (minWidth: string) => ({
		minWidth: `min(${minWidth}, 100%)`
	}),
	blockAlign: (marginInline: string) => ({
		marginInline
	}),
	cellMinWidth: (minWidth: string) => ({
		minWidth
	})
});

const cellAlignStyles = stylex.create({
	start: { textAlign: 'start' },
	center: { textAlign: 'center' },
	// Upstream migrated this to logical `end` at 0.3.0, retiring the physical
	// exception this port carried at 0.2.0. The *parser* value is still the GFM
	// `---:` marker (`'right'`); only the declaration is logical.
	end: { textAlign: 'end' }
});

/**
 * Cell sizing for Markdown's own default Table part, layered over Table's
 * wrap-mode defaults. Table's wrap mode clamps every cell's min-content
 * contribution, so a Markdown table would divide its container equally; here
 * the cell reports an honest min-content, the header wraps instead of
 * truncating, and `box-sizing: content-box` makes the per-column `ch` floor a
 * floor on the text box rather than on the padded border box.
 */
const markdownTableCellStyles = stylex.create({
	cell: {
		boxSizing: 'content-box',
		maxWidth: 'none',
		overflow: 'visible',
		overflowWrap: 'break-word',
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-2'],
		wordBreak: 'normal'
	},
	headerCell: {
		boxSizing: 'content-box',
		maxWidth: 'none',
		overflow: 'visible',
		overflowWrap: 'break-word',
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-2'],
		textOverflow: 'clip',
		whiteSpace: 'normal',
		wordBreak: 'normal'
	},
	// Inline Code sets `word-break: break-word` so a long token cannot widen a
	// paragraph. Inside a table cell that same rule zeroes the token's
	// min-content and splits an identifier across lines; the cell keeps it whole
	// and lets the column carry the width instead.
	code: {
		wordBreak: 'normal'
	},
	// A cell that reads against its table draws the column rule on the table's
	// inline-end side, which is the cell's own inline-start.
	ruleOnTableEnd: {
		borderInlineEndWidth: 0,
		borderInlineStartWidth: {
			default: borderVars['--border-width'],
			':last-child': '0'
		},
		borderInlineStartStyle: 'solid',
		borderInlineStartColor: colorVars['--color-border']
	},
	// The grid's outer edge — `dividers="grid"` stops at the table's rim, so
	// without this the top, bottom, and sides stay open. On the table element,
	// so `border-collapse: collapse` merges it with the cell lines.
	tableOuterEdge: {
		borderWidth: borderVars['--border-width'],
		borderStyle: 'solid',
		borderColor: colorVars['--color-border']
	}
});

const styles = stylex.create({
	root: {
		fontFamily: typographyVars['--font-family-body'],
		color: colorVars['--color-text-primary'],
		lineHeight: typeScaleVars['--text-body-leading'],
		fontSize: typeScaleVars['--text-body-size'],
		width: '100%',
		maxWidth: '100%',
		minWidth: 0,
		overflowWrap: 'break-word'
	},
	inlineRoot: {
		display: 'inline',
		width: 'auto',
		maxWidth: 'none',
		fontFamily: 'inherit',
		color: 'inherit',
		lineHeight: 'inherit',
		fontSize: 'inherit'
	},
	// Headings
	headingBase: {
		fontFamily: typographyVars['--font-family-heading'],
		color: colorVars['--color-text-primary']
	},
	h1: {
		fontSize: typeScaleVars['--text-heading-1-size'],
		fontWeight: typeScaleVars['--text-heading-1-weight'],
		lineHeight: typeScaleVars['--text-heading-1-leading']
	},
	h2: {
		fontSize: typeScaleVars['--text-heading-2-size'],
		fontWeight: typeScaleVars['--text-heading-2-weight'],
		lineHeight: typeScaleVars['--text-heading-2-leading']
	},
	h3: {
		fontSize: typeScaleVars['--text-heading-3-size'],
		fontWeight: typeScaleVars['--text-heading-3-weight'],
		lineHeight: typeScaleVars['--text-heading-3-leading']
	},
	h4: {
		fontSize: typeScaleVars['--text-heading-4-size'],
		fontWeight: typeScaleVars['--text-heading-4-weight'],
		lineHeight: typeScaleVars['--text-heading-4-leading']
	},
	h5: {
		fontSize: typeScaleVars['--text-heading-5-size'],
		fontWeight: typeScaleVars['--text-heading-5-weight'],
		lineHeight: typeScaleVars['--text-heading-5-leading']
	},
	h6: {
		fontSize: typeScaleVars['--text-heading-6-size'],
		fontWeight: typeScaleVars['--text-heading-6-weight'],
		lineHeight: typeScaleVars['--text-heading-6-leading']
	},
	// Block spacing — per element type, default density
	spacingHeadingMajorDefault: {
		marginBlockStart: spacingVars['--spacing-6'],
		marginBlockEnd: spacingVars['--spacing-3']
	},
	spacingHeadingMinorDefault: {
		marginBlockStart: spacingVars['--spacing-4'],
		marginBlockEnd: spacingVars['--spacing-2']
	},
	spacingParagraphDefault: {
		marginBlockStart: spacingVars['--spacing-3'],
		marginBlockEnd: spacingVars['--spacing-3']
	},
	spacingCodeblockDefault: {
		marginBlockStart: spacingVars['--spacing-4'],
		marginBlockEnd: spacingVars['--spacing-4']
	},
	spacingBlockquoteDefault: {
		marginBlockStart: spacingVars['--spacing-4'],
		marginBlockEnd: spacingVars['--spacing-4']
	},
	spacingListDefault: {
		marginBlockStart: spacingVars['--spacing-3'],
		marginBlockEnd: spacingVars['--spacing-3']
	},
	spacingTableDefault: {
		marginBlockStart: spacingVars['--spacing-4'],
		marginBlockEnd: spacingVars['--spacing-4']
	},
	spacingHrDefault: {
		marginBlockStart: spacingVars['--spacing-6'],
		marginBlockEnd: spacingVars['--spacing-6']
	},
	spacingImageDefault: {
		marginBlockStart: spacingVars['--spacing-3'],
		marginBlockEnd: spacingVars['--spacing-3']
	},
	// Block spacing — per element type, compact density
	spacingHeadingMajorCompact: {
		marginBlockStart: spacingVars['--spacing-4'],
		marginBlockEnd: spacingVars['--spacing-2']
	},
	spacingHeadingMinorCompact: {
		marginBlockStart: spacingVars['--spacing-3'],
		marginBlockEnd: spacingVars['--spacing-1']
	},
	spacingParagraphCompact: {
		marginBlockStart: spacingVars['--spacing-1'],
		marginBlockEnd: spacingVars['--spacing-1']
	},
	spacingCodeblockCompact: {
		marginBlockStart: spacingVars['--spacing-2'],
		marginBlockEnd: spacingVars['--spacing-2']
	},
	spacingBlockquoteCompact: {
		marginBlockStart: spacingVars['--spacing-2'],
		marginBlockEnd: spacingVars['--spacing-2']
	},
	spacingListCompact: {
		marginBlockStart: spacingVars['--spacing-1'],
		marginBlockEnd: spacingVars['--spacing-1']
	},
	spacingTableCompact: {
		marginBlockStart: spacingVars['--spacing-2'],
		marginBlockEnd: spacingVars['--spacing-2']
	},
	spacingHrCompact: {
		marginBlockStart: spacingVars['--spacing-3'],
		marginBlockEnd: spacingVars['--spacing-3']
	},
	spacingImageCompact: {
		marginBlockStart: spacingVars['--spacing-2'],
		marginBlockEnd: spacingVars['--spacing-2']
	},
	noMarginBlockStart: {
		marginBlockStart: 0
	},
	noMarginBlockEnd: {
		marginBlockEnd: 0
	},
	// Table
	codeBlockWrapper: {
		maxWidth: '100%'
	},
	tableWrapper: {
		// No `overflow-x` here: Table's own Scroll region is the table's
		// scroller, and this block is exactly as wide as it, so a second scroll
		// container would only add a dead focus stop.
		maxWidth: '100%',
		'--container-padding-inline-start': '0px',
		'--container-padding-inline-end': '0px',
		'--container-padding-block-start': '0px',
		'--container-padding-block-end': '0px'
	},
	blockIndent: {
		marginInline: `calc(-1 * ${spacingVars['--spacing-2']})`,
		// Static Markdown lists never host swipe actions. Let outside counter ink
		// paint through both ordered and unordered ancestors.
		overflowInline: 'visible'
	},
	// Numbered document lists keep their ordinary text inset regardless of
	// counter width, matching RichText's native outside markers.
	markerGutter: {
		marginInlineStart: `calc(-1 * (${spacingVars['--spacing-2']} + ${spacingVars['--spacing-4']}))`,
		paddingInlineStart: spacingVars['--spacing-4']
	},
	// HR
	hr: {
		borderWidth: 0,
		borderTopWidth: borderVars['--border-width'],
		borderTopStyle: 'solid',
		borderTopColor: colorVars['--color-border']
	},
	// Image
	image: {
		maxWidth: '100%',
		borderRadius: radiusVars['--radius-element']
	},
	// Inline
	bold: {
		fontWeight: fontWeightVars['--font-weight-semibold']
	},
	strikethrough: {
		color: colorVars['--color-text-secondary']
	},
	link: {
		color: colorVars['--color-text-accent'],
		textDecoration: 'underline'
	}
});

const streamingStyles = stylex.create({
	fadeIn: {
		opacity: 1,
		transitionProperty: 'opacity',
		// Collapse the entry fade to an instant swap under reduced motion. The
		// 0s duration makes the @starting-style opacity jump non-animated (the
		// media query can't nest inside @starting-style), mirroring the
		// conditional-duration form in Spinner.
		transitionDuration: {
			default: durationVars['--duration-medium'],
			'@media (prefers-reduced-motion: reduce)': '0s'
		},
		transitionTimingFunction: easeVars['--ease-standard'],
		'@starting-style': {
			opacity: 0
		}
	}
});

const headingStyles = {
	1: styles.h1,
	2: styles.h2,
	3: styles.h3,
	4: styles.h4,
	5: styles.h5,
	6: styles.h6
} as const;

export type MarkdownDensity = 'default' | 'compact';
export type MarkdownContentAlign = 'start' | 'center';

/**
 * The per-block-type margin pair, ported from upstream's `getElementSpacing`.
 * Exhaustive over `BlockNode['type']`, as upstream's switch is.
 */
function getElementSpacing(node: BlockNode, density: MarkdownDensity): StyleArg {
	const compact = density === 'compact';
	switch (node.type) {
		case 'heading':
			return node.level <= 3
				? compact
					? styles.spacingHeadingMajorCompact
					: styles.spacingHeadingMajorDefault
				: compact
					? styles.spacingHeadingMinorCompact
					: styles.spacingHeadingMinorDefault;
		case 'paragraph':
			return compact ? styles.spacingParagraphCompact : styles.spacingParagraphDefault;
		case 'codeblock':
			return compact ? styles.spacingCodeblockCompact : styles.spacingCodeblockDefault;
		case 'blockquote':
			return compact ? styles.spacingBlockquoteCompact : styles.spacingBlockquoteDefault;
		case 'list':
			return compact ? styles.spacingListCompact : styles.spacingListDefault;
		case 'table':
			return compact ? styles.spacingTableCompact : styles.spacingTableDefault;
		case 'hr':
			return compact ? styles.spacingHrCompact : styles.spacingHrDefault;
		case 'image':
			return compact ? styles.spacingImageCompact : styles.spacingImageDefault;
	}
}

/** Everything a block-level element needs to build its own `sx()` call. */
export interface BlockStyleContext {
	node: BlockNode;
	density: MarkdownDensity;
	contentWidthValue: string | null;
	contentAlign: MarkdownContentAlign;
	isFirst: boolean;
	isLast: boolean;
}

/** The prose-column width/alignment pair applied to headings, paragraphs, lists. */
function proseStyles(ctx: BlockStyleContext): StyleArg[] {
	return [
		ctx.contentWidthValue != null ? dynamicStyles.proseWidth(ctx.contentWidthValue) : null,
		ctx.contentAlign !== 'start' ? dynamicStyles.proseAlign(ALIGN_MARGIN[ctx.contentAlign]) : null
	];
}

/** The block (table / code block) width + alignment pair. */
function blockStyles(ctx: BlockStyleContext): StyleArg[] {
	return [
		ctx.contentWidthValue != null ? dynamicStyles.blockWidth(ctx.contentWidthValue) : null,
		BLOCK_ALIGN_MARGIN[ctx.contentAlign] != null
			? dynamicStyles.blockAlign(BLOCK_ALIGN_MARGIN[ctx.contentAlign] as string)
			: null
	];
}

function edgeStyles(ctx: BlockStyleContext): StyleArg[] {
	return [ctx.isFirst && styles.noMarginBlockStart, ctx.isLast && styles.noMarginBlockEnd];
}

/** The root `<div role="document">` / `<span>` for inline display. */
export function markdownRootAttrs(isInline: boolean, xstyle: StyleArg): SvelteStyleAttrs {
	return sx(styles.root, isInline && styles.inlineRoot, xstyle);
}

/** `h1`–`h6`. */
export function markdownHeadingAttrs(
	ctx: BlockStyleContext,
	level: 1 | 2 | 3 | 4 | 5 | 6
): SvelteStyleAttrs {
	return sx(
		styles.headingBase,
		headingStyles[level],
		getElementSpacing(ctx.node, ctx.density),
		...proseStyles(ctx),
		...edgeStyles(ctx)
	);
}

/**
 * The heading's own text style, for the plugin-owned row. The row carries the
 * spacing, prose width and alignment, so the heading element takes only its
 * base and level typography.
 */
export function markdownHeadingTextStyle(level: 1 | 2 | 3 | 4 | 5 | 6): StyleArg[] {
	return [styles.headingBase, headingStyles[level]];
}

/** The block spacing and first/last edge, applied to the plugin-owned row. */
export function markdownHeadingBlockSpacingStyle(ctx: BlockStyleContext): StyleArg[] {
	return [getElementSpacing(ctx.node, ctx.density), ...edgeStyles(ctx)];
}

/**
 * The `h1`–`h6` element while the heading-links module owns its row: upstream
 * adds `headingLinksHeadingStyle`'s flex/min-width/margin reset, and the row
 * takes the prose column instead.
 */
export function markdownHeadingLinksHeadingAttrs(level: 1 | 2 | 3 | 4 | 5 | 6): SvelteStyleAttrs {
	return sx(styles.headingBase, headingLinksHeadingStyle, headingStyles[level]);
}

/** The `<div role="paragraph">` a markdown paragraph renders as. */
export function markdownParagraphAttrs(ctx: BlockStyleContext): SvelteStyleAttrs {
	return sx(getElementSpacing(ctx.node, ctx.density), ...proseStyles(ctx), ...edgeStyles(ctx));
}

/** The wrapper `<div>` around a fenced code block. */
export function markdownCodeBlockWrapperAttrs(ctx: BlockStyleContext): SvelteStyleAttrs {
	return sx(getElementSpacing(ctx.node, ctx.density), styles.codeBlockWrapper, ...edgeStyles(ctx));
}

/** The `xstyle` handed to the inner `CodeBlock`. */
export function markdownCodeBlockXstyle(ctx: BlockStyleContext): StyleArg[] {
	return [
		ctx.contentWidthValue != null ? dynamicStyles.blockWidth(ctx.contentWidthValue) : undefined,
		BLOCK_ALIGN_MARGIN[ctx.contentAlign] != null
			? dynamicStyles.blockAlign(BLOCK_ALIGN_MARGIN[ctx.contentAlign] as string)
			: null
	];
}

/** The `xstyle` handed to `Blockquote`. */
export function markdownBlockquoteXstyle(ctx: BlockStyleContext): StyleArg[] {
	return [
		getElementSpacing(ctx.node, ctx.density),
		ctx.contentWidthValue != null ? dynamicStyles.proseWidth(ctx.contentWidthValue) : undefined,
		ctx.contentAlign !== 'start'
			? dynamicStyles.proseAlign(ALIGN_MARGIN[ctx.contentAlign])
			: undefined,
		...edgeStyles(ctx)
	];
}

/** The wrapper `<div>` around a task list. Carries no prose width upstream. */
export function markdownTaskListWrapperAttrs(ctx: BlockStyleContext): SvelteStyleAttrs {
	return sx(getElementSpacing(ctx.node, ctx.density), ...edgeStyles(ctx));
}

/** The wrapper `<div>` around a plain list. */
export function markdownListWrapperAttrs(ctx: BlockStyleContext): SvelteStyleAttrs {
	return sx(getElementSpacing(ctx.node, ctx.density), ...proseStyles(ctx), ...edgeStyles(ctx));
}

/** The negative inline margin both list flavours hand to `List`/`CheckboxList`. */
export const markdownBlockIndentXstyle: StyleArg = styles.blockIndent;

/**
 * The list's inset: the block indent, plus the marker gutter that keeps an
 * ordered list's ordinary text inset whatever the counter width.
 */
export function markdownListIndentXstyle(ordered: boolean): StyleArg {
	return [styles.blockIndent, ordered && styles.markerGutter];
}

/** The horizontal-scrolling `<div>` around a table. */
export function markdownTableWrapperAttrs(ctx: BlockStyleContext): SvelteStyleAttrs {
	return sx(
		styles.tableWrapper,
		getElementSpacing(ctx.node, ctx.density),
		...blockStyles(ctx),
		...edgeStyles(ctx)
	);
}

/** The table element's own outer edge, under `dividers="grid"`. */
export const markdownTableOuterEdgeStyle: StyleArg = markdownTableCellStyles.tableOuterEdge;

/** A body cell: the cell box plus its column alignment and rule. */
export function markdownCellXstyle(
	alignment: 'left' | 'center' | 'right' | null,
	isAgainstTable = false
): StyleArg[] {
	return [markdownTableCellStyles.cell, ...tableCellSideStyles(alignment, isAgainstTable)];
}

/** A header cell: the header box, its `ch` floor, alignment and rule. */
export function markdownHeaderCellXstyle(
	minWidth: number | null,
	alignment: 'left' | 'center' | 'right' | null,
	isAgainstTable = false
): StyleArg[] {
	return [
		markdownTableCellStyles.headerCell,
		minWidth != null ? dynamicStyles.cellMinWidth(`${minWidth}ch`) : null,
		...tableCellSideStyles(alignment, isAgainstTable)
	];
}

/**
 * The alignment and column-rule styles for a Markdown table cell. For a cell
 * that reads against its table, the table's start is the cell's end, so an
 * explicit alignment and the rule swap logical sides.
 */
function tableCellSideStyles(
	align: 'left' | 'center' | 'right' | null,
	isAgainstTable: boolean
): StyleArg[] {
	return [
		align === 'center' && cellAlignStyles.center,
		align === 'right' && (isAgainstTable ? cellAlignStyles.start : cellAlignStyles.end),
		align === 'left' && isAgainstTable && cellAlignStyles.end,
		isAgainstTable && markdownTableCellStyles.ruleOnTableEnd
	];
}

/** Inline code inside a table cell keeps its token whole. */
export const markdownTableCellCodeStyle: StyleArg = markdownTableCellStyles.code;

/** `<hr>`. */
export function markdownHrAttrs(ctx: BlockStyleContext): SvelteStyleAttrs {
	return sx(styles.hr, getElementSpacing(ctx.node, ctx.density), ...edgeStyles(ctx));
}

/** The wrapper `<div>` around a block-level image (and its unsafe-URL fallback). */
export function markdownImageBlockAttrs(ctx: BlockStyleContext): SvelteStyleAttrs {
	return sx(getElementSpacing(ctx.node, ctx.density), ...edgeStyles(ctx));
}

/** `<img>`, inline and block. */
export function markdownImageAttrs(): SvelteStyleAttrs {
	return sx(styles.image);
}

/** `<strong>`. */
export function markdownBoldAttrs(): SvelteStyleAttrs {
	return sx(styles.bold);
}

/** `<del>`. */
export function markdownStrikethroughAttrs(): SvelteStyleAttrs {
	return sx(styles.strikethrough);
}

/** `<a>` / the resolved link component. */
export function markdownLinkAttrs(): SvelteStyleAttrs {
	return sx(styles.link);
}

/** The fading half of a streamed text span. */
export function markdownFadeInAttrs(): SvelteStyleAttrs {
	return sx(streamingStyles.fadeIn);
}
