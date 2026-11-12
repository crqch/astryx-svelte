import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { overlayPaddingReset } from '../../internal/padding.stylex.js';
import { layerStructureReset } from './layer-structure-reset.stylex.js';
import { layerTextReset } from './layer-text-reset.stylex.js';
import { layerViewportInset } from './layer-viewport-inset.stylex.js';

/**
 * The layer container's own styles, from Astryx's `Layer/useLayer.tsx`.
 *
 * They live in a `.stylex.ts` module rather than beside the hook because the
 * StyleX bundler plugin Babel-parses anything importing `@stylexjs/stylex`, and
 * `use-layer.svelte.ts` has to stay a plain rune module. Upstream keeps them in
 * `useLayer.tsx` for the same reason in reverse — a `.tsx` file is already JSX.
 */
const styles = stylex.create({
	// The software keyboard's block-size cap, on the layer's own element. Every
	// layer sets it, an uncapped one to a limit no viewport cap reaches. So a
	// layer nested in a capped one does not inherit the outer cap. The surfaces
	// inside a layer read it through `layerViewportInset.maxBlockSize`. The cap
	// also writes the overflow a capped surface takes. Popover's surface reads
	// it, so it scrolls from the commit that caps it. Beside it, the keyboard's
	// inset from the viewport's bottom lets a layer that places itself slide
	// above the keyboard. Every layer sets it, `initial` until a keyboard is up,
	// so a nested layer does not inherit it. All three are private runtime
	// state, never set by an app or a theme.
	// SYNC: the properties are LAYER_KEYBOARD_CAP_PROPERTY,
	// LAYER_KEYBOARD_OVERFLOW_PROPERTY and LAYER_KEYBOARD_INSET_PROPERTY
	// (useLayerKeyboardClearance.ts).
	keyboardCap: (cap: string, overflow: 'auto' | 'visible', inset: string) => ({
		'--_layer-keyboard-max-block-size': cap,
		'--_layer-keyboard-overflow': overflow,
		'--_layer-keyboard-inset-block-end': inset
	}),
	// A layer that keeps its anchor clear scrolls only once its content
	// overflows the box it was given. A layer that fits has no scroll range, so
	// a wheel over it scrolls the page. Nothing contains the scroll, so a tall
	// layer chains to the page at its end.
	scrollsOnOverflow: {
		overflowY: 'auto'
	},
	// Base reset for all layers
	base: {
		marginBlockStart: 0,
		marginBlockEnd: 0,
		marginInlineStart: 0,
		marginInlineEnd: 0,
		paddingBlockStart: 0,
		paddingBlockEnd: 0,
		paddingInlineStart: 0,
		paddingInlineEnd: 0,
		borderWidth: 0,
		borderStyle: 'none',
		overflow: 'visible',
		// Override browser default [popover] background (canvas color)
		backgroundColor: 'transparent'
	},
	// Fixed positioning mode
	fixed: {
		position: 'fixed'
	},
	// Margins on the placement axis: the anchor clearance on the edge facing
	// the anchor, the viewport gutter on the far edge (spec:AST-059 FR1, FR6).
	// The margin box is what must fit a position option and what the browser's
	// overflow shift keeps inside the viewport, so a layer that would end
	// inside the gutter — or under a declared bar — does not fit there and the
	// next option is tried. A flip tactic swaps the two values with the area,
	// so the clearance stays on the anchor side and the gutter on the far side
	// (#4803); for the same reason the gutter is one value for both edges, the
	// larger of the two block gutters.
	placementBelow: (offset: string) => ({
		marginBlockStart: offset,
		marginBlockEnd: layerViewportInset.gutterBlock
	}),
	placementAbove: (offset: string) => ({
		marginBlockStart: layerViewportInset.gutterBlock,
		marginBlockEnd: offset
	}),
	placementEnd: (offset: string) => ({
		marginInlineStart: offset,
		marginInlineEnd: layerViewportInset.gutterInline
	}),
	placementStart: (offset: string) => ({
		marginInlineStart: layerViewportInset.gutterInline,
		marginInlineEnd: offset
	}),
	// Flush against the anchor (no offset): only the far-edge gutter.
	farBelow: { marginBlockEnd: layerViewportInset.gutterBlock },
	farAbove: { marginBlockStart: layerViewportInset.gutterBlock },
	farEnd: { marginInlineEnd: layerViewportInset.gutterInline },
	farStart: { marginInlineStart: layerViewportInset.gutterInline },
	// The viewport inset (spec:AST-059 FR1–FR3). Every anchor-mode layer is
	// capped to the viewport minus both gutters on both axes and keeps the
	// runtime's gutter from the far viewport edge of its alignment axis as a
	// margin (the placement-axis gutter rides the placement margins above).
	// The cap is on the layer box itself: content wider than the viewport
	// overflows inside the layer, where the composing component decides
	// whether it scrolls or clips; the box never leaves the viewport.
	// Each constant is wrapped in `calc()` so both declarations ship (see
	// layerViewportInset).
	viewportFit: {
		boxSizing: 'border-box',
		maxInlineSize: stylex.firstThatWorks(
			`calc(${layerViewportInset.maxInlineSize})`,
			`calc(${layerViewportInset.maxInlineSizeFallback})`
		),
		maxBlockSize: stylex.firstThatWorks(
			`calc(${layerViewportInset.maxBlockSize})`,
			`calc(${layerViewportInset.maxBlockSizeFallback})`
		)
	},
	// Alignment-axis gutter (spec:AST-059 FR1): a margin on the far viewport
	// edge of the alignment axis — one on the anchor-facing edge would push an
	// aligned layer off its anchor — or both edges for a centered layer. The
	// flip tactic mirrors it with the area. The slide options carry both
	// (see layerSlideRules.ts).
	gutterInlineEnd: {
		marginInlineEnd: stylex.firstThatWorks(
			`calc(${layerViewportInset.gutterInline})`,
			`calc(${layerViewportInset.gutterInlineFallback})`
		)
	},
	gutterInlineStart: {
		marginInlineStart: stylex.firstThatWorks(
			`calc(${layerViewportInset.gutterInline})`,
			`calc(${layerViewportInset.gutterInlineFallback})`
		)
	},
	gutterBlockEnd: {
		marginBlockEnd: stylex.firstThatWorks(
			`calc(${layerViewportInset.gutterBlock})`,
			`calc(${layerViewportInset.gutterBlockFallback})`
		)
	},
	gutterBlockStart: {
		marginBlockStart: stylex.firstThatWorks(
			`calc(${layerViewportInset.gutterBlock})`,
			`calc(${layerViewportInset.gutterBlockFallback})`
		)
	}
});

/** Upstream's `toCssLength` — a bare number is px. */
function toCssLength(value: number | string): string {
	return typeof value === 'number' ? `${value}px` : value;
}

/**
 * The gutter styles for a placement/alignment pair: the far viewport edge of
 * the alignment axis, or both edges when centered (spec:AST-059 FR1).
 */
function gutterStyles(
	placement: 'above' | 'below' | 'start' | 'end',
	alignment: 'start' | 'center' | 'end'
) {
	if (placement === 'above' || placement === 'below') {
		if (alignment === 'start') {
			return [styles.gutterInlineEnd];
		}
		if (alignment === 'end') {
			return [styles.gutterInlineStart];
		}
		return [styles.gutterInlineStart, styles.gutterInlineEnd];
	}
	if (alignment === 'start') {
		return [styles.gutterBlockEnd];
	}
	if (alignment === 'end') {
		return [styles.gutterBlockStart];
	}
	return [styles.gutterBlockStart, styles.gutterBlockEnd];
}

/**
 * Resolve the popover container's classes.
 *
 * Reproduces both of upstream's `stylex.props` calls: context mode combines
 * `base`, the keyboard cap, the anchor-clear scroll, the viewport fit and its
 * gutter with the caller's `xstyle`; fixed mode swaps all of that for `fixed`.
 *
 * `offset` composes between the two, as upstream does: anchor mode only
 * (custom mode owns its own insets), and the axis follows the placement. The
 * placement margins are `stylex.create` **function styles**, so the class
 * oracle cannot see them; the CSS oracle is what proves those.
 */
export function layerAttrs(
	isFixed: boolean,
	xstyle?: StyleArg,
	offset?: number | string,
	positioning: 'anchor' | 'custom' = 'anchor',
	placement: 'above' | 'below' | 'start' | 'end' = 'above',
	alignment: 'start' | 'center' | 'end' = 'center',
	keepsAnchorClear = false
): SvelteStyleAttrs {
	const clearance = offset ? toCssLength(offset) : null;
	const offsetStyle =
		positioning !== 'anchor'
			? null
			: clearance == null
				? placement === 'above'
					? styles.farAbove
					: placement === 'below'
						? styles.farBelow
						: placement === 'start'
							? styles.farStart
							: styles.farEnd
				: placement === 'above'
					? styles.placementAbove(clearance)
					: placement === 'below'
						? styles.placementBelow(clearance)
						: placement === 'start'
							? styles.placementStart(clearance)
							: styles.placementEnd(clearance);

	const viewportStyles =
		!isFixed && positioning === 'anchor'
			? [styles.viewportFit, ...gutterStyles(placement, alignment)]
			: null;

	// The overlay root is not inside any padded container, so the inherited
	// container padding vars are reset at its boundary. Upstream applies it
	// immediately after `styles.base` at both call sites, so the cap, the
	// gutter and the placement margins still win over it, as they do there.
	return sx(
		layerTextReset.reset,
		layerStructureReset.reset,
		styles.base,
		overlayPaddingReset.reset,
		// A fixed layer is never capped; it still sets its own limit so it is
		// not clamped by a capped layer it sits in.
		styles.keyboardCap('100vh', 'visible', 'initial'),
		!isFixed && keepsAnchorClear && styles.scrollsOnOverflow,
		!isFixed && viewportStyles,
		isFixed && styles.fixed,
		offsetStyle,
		xstyle
	);
}
