import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { spacingVars } from '../../styles/tokens.stylex.js';
import { layerAnimations } from '../layer/layer-animations.stylex.js';
import { layerViewportInset } from '../layer/layer-viewport-inset.stylex.js';
import type { LayerPlacement } from '../layer/use-layer.svelte.js';

/**
 * The `Popover` component's own styles, from Astryx's `Popover/Popover.tsx`.
 *
 * Separate from `use-popover.stylex.ts` because upstream keeps two `stylex.create`
 * calls — one beside the hook (surface, focus-trap wrapper, close button) and one
 * beside the component (anchor wrapper, content padding, width). The oracle
 * diffs each `.stylex.ts` against its upstream file, so the split is preserved.
 */
const styles = stylex.create({
	// Stable anchor wrapper — uses inline-flex to generate a box for CSS
	// anchor positioning without affecting layout. The trigger element (e.g.
	// Button) renders inside this wrapper. Because the wrapper itself is
	// the anchor, pressed-state transforms on the child (e.g. `:active` scale)
	// don't shift the anchor position and cause popover jitter.
	anchorWrapper: {
		display: 'inline-flex'
	},
	// Visual styles for the inner content container. Upstream 0.7.13 passes the
	// padding to `usePopover` so it lands on the painted surface; this port keeps
	// it on the content wrapper until the surface-padding option is ported.
	contentPadding: {
		paddingBlockStart: spacingVars['--spacing-3'],
		paddingBlockEnd: spacingVars['--spacing-3'],
		paddingInlineStart: spacingVars['--spacing-3'],
		paddingInlineEnd: spacingVars['--spacing-3']
	},
	// The sheet's fallback close control: hidden until it is reached, as the
	// anchored surface's is, on the Button itself rather than a wrapper
	// (architecture:component-style-authoring INV7). Taken out of flow and
	// clipped at rest, it rejoins the flow when focused, set below the content
	// with room for its focus ring.
	sheetFallbackClose: {
		position: {
			default: 'absolute',
			':focus': 'relative'
		},
		clipPath: {
			default: 'inset(50%)',
			':focus': 'none'
		},
		marginBlockStart: {
			default: 0,
			':focus': spacingVars['--spacing-3']
		},
		// Block-level when revealed, so it starts its own line below inline
		// content rather than sitting on its last line.
		display: {
			default: null,
			':focus': 'flex'
		},
		width: {
			default: null,
			':focus': 'fit-content'
		}
	},
	// The painted surface is capped to the viewport with the layer runtime's
	// one definition (spec:AST-059 FR2, FR3): the layer box above it caps the
	// block axis itself and leaves the inline axis to the surface, so a flip is
	// still chosen when the surface does not fit beside the trigger.
	surfaceViewportFit: {
		boxSizing: 'border-box',
		maxInlineSize: stylex.firstThatWorks(
			`calc(${layerViewportInset.maxInlineSize})`,
			`calc(${layerViewportInset.maxInlineSizeFallback})`
		),
		maxBlockSize: stylex.firstThatWorks(
			`calc(${layerViewportInset.maxBlockSize})`,
			`calc(${layerViewportInset.maxBlockSizeFallback})`
		),
		// A scroll container from the commit in which the software keyboard caps
		// the layer, a frame before the overflow measure sees the shorter box.
		// Otherwise `visible`.
		// SYNC: LAYER_KEYBOARD_OVERFLOW_PROPERTY (Layer/useLayerKeyboardClearance.ts).
		overflow: 'var(--_layer-keyboard-overflow, visible)' as 'auto' | 'visible'
	},
	surfaceScrollable: {
		overflow: 'auto',
		overscrollBehavior: 'contain'
	},
	// An explicit width renders at its size up to the viewport cap, never
	// shrunk to the room beside the trigger (spec:AST-059 FR2). Keywords cannot
	// sit inside min(); the surface cap above bounds them.
	customWidth: (width: string | number) => ({
		width: typeof width === 'number' ? `${width}px` : width
	}),
	// Without a width the surface prefers the trigger's minimum width, clamped
	// by the runtime's cap because a CSS minimum beats a maximum (FR7).
	matchTrigger: {
		minWidth: stylex.firstThatWorks(
			`min(anchor-size(width), ${layerViewportInset.maxInlineSize})`,
			`min(anchor-size(width), ${layerViewportInset.maxInlineSizeFallback})`,
			'anchor-size(width)'
		)
	}
});

/** The inline-flex anchor wrapper for automatic (children) mode. */
export function popoverAnchorWrapperAttrs(): SvelteStyleAttrs {
	return sx(styles.anchorWrapper);
}

/**
 * The sheet presentation's fallback close control. Upstream passes the style
 * as the `Button`'s `xstyle`, on the button itself rather than a wrapper
 * (architecture:component-style-authoring INV7).
 */
export function popoverSheetFallbackCloseXstyle(): StyleArg {
	return styles.sheetFallbackClose;
}

/**
 * The painted surface's own classes: the viewport cap, the scroll container
 * once its content overflows it, and the pointer presentation's entrance.
 * Upstream 0.7.13 hands all three to `usePopover` as surface `xstyle`; here
 * `<PopoverLayer>` owns the surface element. The entrance lives on the
 * surface, not the anchored layer: Chromium lays an anchored element out
 * again each time it restyles it, and the touch presentation turns this
 * entrance off on the element it grows (popover-surface-motion.ts).
 */
export function popoverSurfaceAttrs(
	hasOverflow: boolean,
	placement: LayerPlacement = 'below'
): SvelteStyleAttrs {
	return sx(
		styles.surfaceViewportFit,
		hasOverflow && styles.surfaceScrollable,
		layerAnimations[placement]
	);
}

/**
 * The content-padding `xstyle` layer for the inner content div. Composed with
 * `themeProps('popover')`, `class` and `style` in the component, matching
 * upstream's `mergeProps(themeProps('popover'), stylex.props(padding, xstyle),
 * className, style)`.
 */
export function popoverContentAttrs(xstyle: StyleArg): SvelteStyleAttrs {
	return sx(styles.contentPadding, xstyle);
}

/**
 * The anchored layer container's `xstyle` — upstream's per-`render` array
 * `[popoverXstyle, xstyle]`, where `popoverXstyle = width ?
 * styles.customWidth(width) : styles.matchTrigger`. The pointer entrance moved
 * to the surface at 0.7.13; the gap is the layer's own `offset`.
 */
export function popoverLayerXstyle(width: number | string | undefined): StyleArg {
	return width ? styles.customWidth(width) : styles.matchTrigger;
}
