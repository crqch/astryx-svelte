import * as stylex from '@stylexjs/stylex';
import { cx, mergeStyle, sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	borderVars,
	colorVars,
	durationVars,
	easeVars,
	focusVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';
import { scrollableAreaOverflowStyles } from '../../hooks/use-scrollable-area.stylex.js';

/**
 * Ported from Astryx's `CodeBlock/CodeBlock.tsx`, where the styles are inline in
 * the component file rather than in a module of their own.
 *
 * The `--color-syntax-*` custom properties are read as bare `var()` strings
 * rather than through a token group: they are set by the *theme* (or by a
 * `<SyntaxTheme>` wrapper) rather than declared in `tokens.stylex.ts`, which is
 * exactly how upstream references them.
 */

const containerStyles = stylex.create({
	card: {
		borderRadius: radiusVars['--radius-element'],
		borderWidth: borderVars['--border-width'],
		borderStyle: 'solid',
		borderColor: colorVars['--color-border']
	},
	section: {
		borderRadius: 0,
		borderWidth: 0,
		borderStyle: 'none',
		borderColor: 'transparent',
		// Transparent background so the block blends into the surface it's
		// embedded in (a card or panel) instead of painting its own muted layer,
		// which would compound with a muted parent into a darker grey. Override
		// the syntax-background var so both the root and the sticky header inherit
		// it. Consumers can still set an explicit background via xstyle.
		'--color-syntax-background': 'transparent'
	}
});

const dynamicStyles = stylex.create({
	width: (value: string) => ({
		width: value,
		minWidth: value === 'fit-content' ? 'min(100%, 400px)' : null,
		maxWidth: value === 'fit-content' ? '100%' : null
	}),
	// Width of the line-number column, sized to the widest number. `ch` is the
	// advance of "0" in the (monospace) code font, so N digits => N ch. Set on
	// <code>; `--_codeblock-gutter-width` is unregistered so it inherits (with its var()
	// substituted) down to the line divs that read it for their grid track.
	gutterWidth: (digits: number) => ({
		'--_codeblock-gutter-width': `${digits}ch`
	})
});

// Light reveal so the leading chevron eases into view instead of popping in.
// Growing the chevron's own footprint (width + inline margin) from zero slides
// the title into place instead of snapping it over, and clipping keeps the
// glyph from spilling while it's mid-reveal.
const chevronReveal = stylex.keyframes({
	from: {
		width: 0,
		marginInlineEnd: 0,
		opacity: 0
	},
	to: {
		width: '14px',
		marginInlineEnd: spacingVars['--spacing-1'],
		opacity: 1
	}
});

const styles = stylex.create({
	root: {
		position: 'relative',
		isolation: 'isolate',
		display: 'flex',
		flexDirection: 'column',
		margin: 0,
		backgroundColor: 'var(--color-syntax-background)',
		overflow: 'hidden'
	},
	// The viewport is a flex item of the column root. Its implied min-height
	// would be its content while it fits (the shared capability keeps it
	// `overflow: clip` then), so a root sized from outside could never make it
	// shrink and scroll; 0 lets the root's bound reach it.
	viewport: {
		minHeight: 0
	},
	// The root clips (overflow: hidden, for its corners), so the viewport's
	// keyboard ring sits inside its own box instead of around it.
	viewportFocusRingInset: {
		outlineOffset: {
			default: null,
			':focus-visible': `calc(-1 * ${focusVars['--focus-outline-width']})`
		}
	},
	// With no header, Copy sits in its own inline-end column beside the code
	// viewport rather than over it, so no line, scrolled or wrapped, runs under
	// the button. The column is as wide as its content; the single row still
	// lets a root sized from outside bound the viewport.
	rootCorner: {
		display: 'grid',
		gridTemplateColumns: 'minmax(0, 1fr) auto',
		gridTemplateRows: 'minmax(0, 1fr)'
	},
	headerRow: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingInline: spacingVars['--spacing-4'],
		backgroundColor: 'var(--color-syntax-background)',
		position: 'sticky',
		top: 0,
		zIndex: 1
	},
	header: {
		display: 'flex',
		alignItems: 'center',
		flex: 1,
		minWidth: 0,
		// Reset default <button> appearance for the collapsible title control.
		padding: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		color: 'inherit',
		font: 'inherit',
		textAlign: 'start'
	},
	headerWithDivider: {
		paddingBlock: spacingVars['--spacing-2'],
		borderBottomWidth: borderVars['--border-width'],
		borderBottomStyle: 'solid',
		borderBottomColor: colorVars['--color-border']
	},
	headerCompact: {
		paddingBlock: spacingVars['--spacing-2']
	},
	headerTitle: {
		display: 'flex',
		alignItems: 'center',
		fontSize: typeScaleVars['--text-supporting-size'],
		fontFamily: typographyVars['--font-family-code'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		color: 'var(--color-syntax-comment)',
		margin: 0,
		lineHeight: typeScaleVars['--text-supporting-leading']
	},
	codeWrapper: {
		display: 'flex',
		minWidth: 'fit-content'
	},
	codeWrapperCompact: {
		marginBlockStart: `calc(-1 * ${spacingVars['--spacing-2']})`
	},
	collapseGrid: {
		display: 'grid',
		gridTemplateRows: '1fr',
		transitionProperty: 'grid-template-rows',
		transitionDuration: durationVars['--duration-medium'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	collapseGridCollapsed: {
		gridTemplateRows: '0fr'
	},
	collapseInner: {
		overflow: 'hidden',
		minHeight: 0
	},
	collapseChevron: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
		width: '14px',
		height: '14px',
		marginInlineEnd: spacingVars['--spacing-1'],
		overflow: 'hidden',
		color: 'var(--color-syntax-comment)',
		animationName: {
			default: chevronReveal,
			'@media (prefers-reduced-motion: reduce)': 'none'
		},
		animationDuration: durationVars['--duration-medium'],
		animationTimingFunction: easeVars['--ease-standard']
	},
	// Applied to the chevron <Icon> (via `xstyle`): the glyph is the element that
	// rotates and the element a theme targets, so one selector reaches both.
	collapseChevronIcon: {
		transitionProperty: 'transform',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	collapseChevronExpanded: {
		// Leading disclosure convention (matches TreeList/Table): the resting
		// chevronRight points right (>) when collapsed; rotate it down (v) when
		// expanded.
		transform: 'rotate(90deg)'
	},
	headerCollapsible: {
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		userSelect: 'none'
		// Restore a keyboard-only focus ring with the standard token/offset so this
		// disclosure control matches the rest of the system (Collapsible, TabMenu);
		// otherwise it falls back to the inconsistent UA default outline.
	},
	code: {
		display: 'block',
		flex: 1,
		// The block grows to its longest line, so a row's paint (diff tint,
		// highlightLines) spans the full scroll width instead of stopping at the
		// viewport edge when the reader scrolls a long line.
		minWidth: 'max-content',
		paddingBlock: spacingVars['--spacing-3'],
		paddingInline: spacingVars['--spacing-4'],
		margin: 0,
		fontFamily: typographyVars['--font-family-code'],
		color: 'var(--color-syntax-variable)',
		tabSize: 2,
		whiteSpace: 'pre',
		wordBreak: 'normal',
		overflowWrap: 'normal'
	},
	codeWrapped: {
		// Wrapped lines never overflow, and max-content would stop them wrapping.
		minWidth: 'auto',
		whiteSpace: 'pre-wrap',
		wordBreak: 'break-all',
		overflowWrap: 'break-word'
	},
	// With line numbers on, the <code> element hosts the full-height divider
	// between the number gutter and the code. It spans the code's block padding
	// too (inset-block: 0), so the rule reaches the top and bottom edges the way
	// the old separate gutter column did. The numbers themselves are drawn per
	// line (see `lineNumbered`) — a separate column can't track wrap height.
	codeNumbered: {
		position: 'relative',
		'::after': {
			content: '""',
			position: 'absolute',
			insetBlock: 0,
			insetInlineStart: `calc(${spacingVars['--spacing-4']} + var(--_codeblock-gutter-width) + ${spacingVars['--spacing-3']})`,
			width: 0,
			borderInlineStartWidth: borderVars['--border-width'],
			borderInlineStartStyle: 'solid',
			borderInlineStartColor: colorVars['--color-border'],
			pointerEvents: 'none'
		}
	},
	line: {
		lineHeight: typeScaleVars['--text-code-leading']
	},
	// Per-line number gutter: a two-column grid ([number] [code]). The number is
	// a ::before generated from the data-line attribute. Because the number and
	// its code occupy one grid row, the row grows to fit wrapped code while the
	// number stays pinned to the row's first visual line (alignSelf: start) —
	// this is what keeps numbers aligned when isWrapped wraps a line.
	lineNumbered: {
		display: 'grid',
		gridTemplateColumns: 'var(--_codeblock-gutter-width) 1fr',
		columnGap: `calc(${spacingVars['--spacing-3']} + ${borderVars['--border-width']} + ${spacingVars['--spacing-4']})`,
		'::before': {
			content: 'attr(data-line)',
			gridColumn: '1',
			alignSelf: 'start',
			textAlign: 'end',
			color: 'var(--color-syntax-punctuation)',
			userSelect: 'none',
			fontFamily: typographyVars['--font-family-code']
		}
	},
	// In span mode the tokens are wrapped in this element so they form a single
	// grid item in column 2 (otherwise each token span would flow into its own
	// grid cell). minWidth:0 lets it shrink so long lines wrap within the track.
	lineContent: {
		minWidth: 0
	},
	lineChunk: {
		contentVisibility: 'auto'
	},
	lineHighlighted: {
		backgroundColor: colorVars['--color-accent-muted'],
		marginInline: `calc(-1 * ${spacingVars['--spacing-4']})`,
		paddingInline: spacingVars['--spacing-4']
	},
	// Diff change rows: the whole row is tinted so added and removed lines read
	// at a glance; the text keeps its ordinary colour, which stays readable on
	// the tint where the semantic text colours would not, and the leading +/-
	// glyph stays in the text as the cue that needs no colour. A caller's
	// highlightLines row is declared after these and keeps its background.
	lineAdded: {
		backgroundColor: 'var(--color-syntax-added)',
		marginInline: `calc(-1 * ${spacingVars['--spacing-4']})`,
		paddingInline: spacingVars['--spacing-4'],
		'::before': { color: 'var(--color-syntax-added-marker)' }
	},
	lineRemoved: {
		backgroundColor: 'var(--color-syntax-removed)',
		marginInline: `calc(-1 * ${spacingVars['--spacing-4']})`,
		paddingInline: spacingVars['--spacing-4'],
		'::before': { color: 'var(--color-syntax-removed-marker)' }
	},
	// Hunk and file headers stay visible but quiet: a muted row with secondary
	// text, never change paint.
	lineDiffHeader: {
		backgroundColor: 'var(--color-syntax-diff-header)',
		// The syntax theme's own secondary colour: text-secondary in the default
		// theme, the theme's punctuation colour in a defined one.
		color: 'var(--color-syntax-punctuation)',
		marginInline: `calc(-1 * ${spacingVars['--spacing-4']})`,
		paddingInline: spacingVars['--spacing-4']
	},
	// The glyph column: the +, - or space of every line sits in its own track
	// before the code, so the code column starts at the same inline offset on
	// every line and the content's indentation reads exactly as written. The
	// glyph is laid out as text but not selectable; the copy button still
	// copies the original source with its glyphs.
	lineDiff: {
		display: 'grid',
		gridTemplateColumns: '1ch 1fr',
		columnGap: spacingVars['--spacing-2']
	},
	// With line numbers the gutter's gap (which the full-height divider sits
	// in) has to stay between the number and the marker, so the grid has no
	// gap of its own and the marker carries both gaps as margins.
	lineDiffNumbered: {
		// `auto`, not `1ch`: the marker's gap margins have to widen its track.
		gridTemplateColumns: 'var(--_codeblock-gutter-width) auto 1fr',
		columnGap: 0
	},
	// The glyph is the source's own text: read by assistive technology, kept
	// out of a drag selection (copy returns the exact source anyway).
	diffMarker: {
		color: colorVars['--color-text-secondary'],
		userSelect: 'none',
		whiteSpace: 'pre'
	},
	diffMarkerNumbered: {
		marginInlineStart: `calc(${spacingVars['--spacing-3']} + ${borderVars['--border-width']} + ${spacingVars['--spacing-4']})`,
		marginInlineEnd: spacingVars['--spacing-2']
	},
	// On a tinted row the glyph is the cue a reader without colour depends on,
	// so it takes the row's marker slot like the line number does.
	diffMarkerAdded: {
		color: 'var(--color-syntax-added-marker)'
	},
	diffMarkerRemoved: {
		color: 'var(--color-syntax-removed-marker)'
	},
	sizeSm: {
		fontSize: typeScaleVars['--text-supporting-size']
	},
	sizeMd: {
		fontSize: typeScaleVars['--text-code-size']
	},
	copyButton: {
		// The copy control is a ghost IconButton (Button owns its own padding,
		// radius, and hover surface); this only tints the resting glyph to the
		// muted syntax-comment colour so it blends into the header/corner. A theme
		// reaches it via the `codeblock-copy-button` target on the Button.
		color: 'var(--color-syntax-comment)'
	},
	// The controls of a headerless block: caller controls, then Copy, in the
	// second column (cornerClusterMd/Sm give its height).
	cornerCluster: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		alignSelf: 'start',
		marginInline: spacingVars['--spacing-2']
	},
	// The header's controls: caller controls, then Copy.
	headerControls: {
		display: 'flex',
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		flexShrink: 0
	},
	// The cluster is exactly as tall as the first line's row (its block padding
	// on both sides plus its line box), and centres its controls in it, so any
	// control height sits on the first line: a one-line block reads as one row
	// with even space above and below, and a block that grows keeps its
	// controls where they were.
	cornerClusterMd: {
		blockSize: `calc(2 * ${spacingVars['--spacing-3']} + ${typeScaleVars['--text-code-size']} * ${typeScaleVars['--text-code-leading']})`
	},
	cornerClusterSm: {
		blockSize: `calc(2 * ${spacingVars['--spacing-3']} + ${typeScaleVars['--text-supporting-size']} * ${typeScaleVars['--text-code-leading']})`
	}
});

/**
 * Container variants and text sizes, as **module-private** aliases: upstream
 * inlines both unions in `CodeBlockProps` and publishes no named type for
 * either, unlike `Code`'s `CodeColor`/`CodeSize`. They exist only to keep the
 * attrs signatures below readable, and `code-block.svelte` inlines the same
 * literals in its props rather than importing them.
 */
type CodeBlockContainer = keyof typeof containerStyles;

type CodeBlockSize = 'sm' | 'md';

const sizeStyles = { sm: styles.sizeSm, md: styles.sizeMd } as const;

/** The `<pre>` root. */
export function codeBlockRootAttrs(
	width: string,
	container: CodeBlockContainer,
	hasCorner: boolean,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.root,
		hasCorner && styles.rootCorner,
		dynamicStyles.width(width),
		containerStyles[container],
		xstyle
	);
}

/** The sticky header row holding the title and (when there is a header) the copy button. */
export function codeBlockHeaderRowAttrs(hasLineNumbers: boolean): SvelteStyleAttrs {
	return sx(styles.headerRow, hasLineNumbers ? styles.headerWithDivider : styles.headerCompact);
}

/** The header's inner control — a `role="button"` disclosure when collapsible. */
export function codeBlockHeaderAttrs(canCollapse: boolean): SvelteStyleAttrs {
	return focusOutlineProps.focusVisible(styles.header, canCollapse && styles.headerCollapsible);
}

/** The title/language text. */
export function codeBlockHeaderTitleAttrs(): SvelteStyleAttrs {
	return sx(styles.headerTitle);
}

/** The disclosure chevron's wrapper — the reveal animation and the clip box. */
export function codeBlockCollapseChevronAttrs(): SvelteStyleAttrs {
	return sx(styles.collapseChevron);
}

/** The header's controls column: caller controls, then Copy. */
export function codeBlockHeaderControlsAttrs(): SvelteStyleAttrs {
	return sx(styles.headerControls);
}

/** The headerless block's top-corner controls column, sized to the first line. */
export function codeBlockCornerClusterAttrs(size: CodeBlockSize): SvelteStyleAttrs {
	return sx(styles.cornerCluster, size === 'sm' ? styles.cornerClusterSm : styles.cornerClusterMd);
}

/**
 * Handed to the chevron `Icon`'s `xstyle`, and to `IconButton`'s, the way
 * upstream hands over `styles.collapseChevronIcon` / `styles.copyButton`
 * (#4838, #4867). Both cross a component boundary, so they stay objects rather
 * than being folded into a class string here.
 */
export const codeBlockCollapseChevronIconStyle = styles.collapseChevronIcon;
export const codeBlockCollapseChevronExpandedStyle = styles.collapseChevronExpanded;
export const codeBlockCopyButtonStyle = styles.copyButton;

/** The `grid-template-rows` animation host for the collapsible region. */
export function codeBlockCollapseGridAttrs(isCollapsed: boolean): SvelteStyleAttrs {
	return sx(styles.collapseGrid, isCollapsed && styles.collapseGridCollapsed);
}

/** The overflow-clipping child the collapse grid animates. */
export function codeBlockCollapseInnerAttrs(): SvelteStyleAttrs {
	return sx(styles.collapseInner);
}

/**
 * The scrollable, focusable `role="group"` viewport.
 *
 * Upstream hands this element to `useScrollableArea`, which owns the overflow
 * declarations dynamically. This port keeps the always-scrollable element it
 * has always had, so the overflow pair comes from the same shared dynamic style
 * the hook uses rather than a second static key upstream does not declare.
 * The focus ring is the shared one, with its offset pulled inside the root's
 * clipped corners.
 */
export function codeBlockViewportAttrs(): SvelteStyleAttrs {
	const focus = focusOutlineProps.focusVisible(styles.viewport, styles.viewportFocusRingInset);
	const overflow = sx(scrollableAreaOverflowStyles('auto', 'auto'));
	return {
		class: cx(focus.class, overflow.class),
		style: mergeStyle(focus.style, overflow.style)
	};
}

/** The flex row between the scroll container and `<code>`. */
export function codeBlockCodeWrapperAttrs(isCompact: boolean): SvelteStyleAttrs {
	return sx(styles.codeWrapper, isCompact && styles.codeWrapperCompact);
}

/** The `<code>` element. */
export function codeBlockCodeAttrs(
	size: CodeBlockSize,
	isWrapped: boolean,
	hasLineNumbers: boolean,
	maxDigits: number
): SvelteStyleAttrs {
	return sx(
		styles.code,
		sizeStyles[size],
		isWrapped && styles.codeWrapped,
		hasLineNumbers && styles.codeNumbered,
		hasLineNumbers && dynamicStyles.gutterWidth(maxDigits)
	);
}

/** A `content-visibility: auto` chunk wrapper, used once the block exceeds 100 lines. */
export function codeBlockLineChunkAttrs(): SvelteStyleAttrs {
	return sx(styles.lineChunk);
}

/**
 * One line row.
 *
 * The diff keys below are upstream 0.7.13's declarations, applied in upstream's
 * order. `isDiff` is not ported yet, so the component passes no `diffKind`; the
 * keys still belong to this module's `styles` group and the oracle diffs them.
 */
export function codeBlockLineAttrs(
	hasLineNumbers: boolean,
	isHighlighted: boolean,
	diffKind: 'added' | 'removed' | 'header' | 'context' | null = null
): SvelteStyleAttrs {
	return sx(
		styles.line,
		hasLineNumbers && styles.lineNumbered,
		diffKind != null && styles.lineDiff,
		diffKind != null && hasLineNumbers && styles.lineDiffNumbered,
		diffKind === 'added' && styles.lineAdded,
		diffKind === 'removed' && styles.lineRemoved,
		diffKind === 'header' && styles.lineDiffHeader,
		// Last on purpose: a highlight replaces a diff tint rather than stacking
		// on it, so tokens keep their single-paint contrast.
		isHighlighted && styles.lineHighlighted
	);
}

/** The glyph column of a diff row, before the line's content. */
export function codeBlockDiffMarkerAttrs(
	hasLineNumbers: boolean,
	diffKind: 'added' | 'removed' | 'header' | 'context'
): SvelteStyleAttrs {
	return sx(
		styles.diffMarker,
		hasLineNumbers && styles.diffMarkerNumbered,
		diffKind === 'added' && styles.diffMarkerAdded,
		diffKind === 'removed' && styles.diffMarkerRemoved
	);
}

/** The span-mode wrapper that keeps a line's tokens in one grid cell. */
export function codeBlockLineContentAttrs(): SvelteStyleAttrs {
	return sx(styles.lineContent);
}
