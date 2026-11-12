import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	durationVars,
	easeVars,
	fontWeightVars,
	radiusVars,
	sizeVars,
	spacingVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';
import { tabScope } from './tab.markers.stylex.js';
import type { TabListSize } from './tab-list-context.svelte.js';
import { interactionOverlayStyles } from '../../utils/interaction-overlay.stylex.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';

/**
 * Ported from Astryx's `TabList/Tab.tsx` styles.
 *
 * Both modes, plus a marker. `base`, `hoverBg`, `selected` and `icon` survive as
 * objects (each merged with a dynamic size index and/or conditionals), along
 * with all four size/layout groups; the indicator, label and end-content
 * wrappers folded into literal class strings.
 *
 * `hoverBg` embeds `when.ancestor(':hover', tabScope)`, whose class is derived
 * from the marker module's path — the oracle diffs that key as marker-normalised
 * CSS.
 */
// The touch press's paint, declared by the shared overlay styles on the
// element the controller writes to (`pressedAlpha`) at the press's strength,
// 1 while on and 1 → 0 over the release, and inherited resolved by the layer
// that paints it. See interaction-overlay.stylex.ts.
const pressedOverlayImage = 'var(--_press-paint-image)';

const styles = stylex.create({
	base: {
		position: 'relative',
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacingVars['--spacing-1'],
		paddingInline: spacingVars['--spacing-3'],
		backgroundColor: 'transparent',
		borderWidth: 0,
		borderStyle: 'none',
		borderRadius: radiusVars['--radius-element'],
		fontFamily: 'inherit',
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		fontWeight: fontWeightVars['--font-weight-normal'],
		color: colorVars['--color-text-secondary'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		textDecoration: 'none',
		whiteSpace: 'nowrap',
		transitionProperty: 'color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	hoverBg: {
		position: 'absolute',
		inset: 0,
		margin: 'auto',
		width: '100%',
		borderRadius: radiusVars['--radius-element'],
		pointerEvents: 'none',
		backgroundColor: {
			default: 'transparent',
			[stylex.when.ancestor(':hover', tabScope)]: {
				'@media (hover: hover)': colorVars['--color-overlay-hover']
			},
			// Pressed: the same layer steps up to the pressed overlay, read off the
			// tab the way the hover is, so a press paints on a finger too. Repeated
			// inside the hover-capable branch so it outranks the hover rule there
			// (a media-nested rule carries extra generated priority; see
			// interaction-overlay.stylex.ts).
			[stylex.when.ancestor(':active', tabScope)]: {
				default: colorVars['--color-overlay-pressed'],
				'@media (hover: hover)': colorVars['--color-overlay-pressed'],
				// Under a coarse pointer the touch press model writes
				// `data-astryx-press` on the tab instead, and paints as an image
				// below.
				'@media (pointer: coarse)': 'transparent'
			}
		},
		// The touch press, as an image layer over the colour: an image change is
		// discrete, so the layer's colour transition cannot fade the onset in,
		// and the strength the tab's `pressedAlpha` arms own (1 while on, 1 → 0
		// over the release) is what moves. Coarse pointers only, like the colour
		// arms above; see interaction-overlay.stylex.ts.
		backgroundImage: {
			default: null,
			[stylex.when.ancestor('[data-astryx-press="on"]', tabScope)]: {
				default: null,
				'@media (pointer: coarse)': pressedOverlayImage
			},
			[stylex.when.ancestor('[data-astryx-press="fading"]', tabScope)]: {
				default: null,
				'@media (pointer: coarse)': pressedOverlayImage
			}
		},
		transitionProperty: 'background-color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	selected: {
		color: colorVars['--color-text-primary'],
		fontWeight: fontWeightVars['--font-weight-semibold']
	},
	indicator: {
		position: 'absolute',
		// Sits on the tab's bottom edge by default (-1px). When the tab strip
		// reserves space for a divider rail — TabList `hasDivider` or a Toolbar
		// with a bottom divider — that ancestor sets `--_tab-indicator-bottom`
		// to drop the indicator onto the rail beneath the reserved gap.
		bottom: 'var(--_tab-indicator-bottom, -1px)',
		insetInlineStart: spacingVars['--spacing-3'],
		insetInlineEnd: spacingVars['--spacing-3'],
		height: '2px',
		borderRadius: radiusVars['--radius-full'],
		pointerEvents: 'none',
		transitionProperty: 'opacity, background-color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	indicatorSelected: {
		backgroundColor: colorVars['--color-accent'],
		opacity: 1
	},
	indicatorUnselected: {
		backgroundColor: 'transparent',
		opacity: 0
	},
	icon: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0
	},
	labelContainer: {
		display: 'inline-grid'
	},
	labelText: {
		gridRowStart: 1,
		gridColumnStart: 1
	},
	labelSizer: {
		gridRowStart: 1,
		gridColumnStart: 1,
		visibility: 'hidden',
		pointerEvents: 'none',
		fontWeight: fontWeightVars['--font-weight-semibold']
	},
	endContentWrapper: {
		display: 'inline-flex',
		alignItems: 'center',
		flexShrink: 0
	}
});

// A minimum, not a fixed height: a tab grows with a larger text size, so its
// label is never clipped.
const sizeStyles = stylex.create({
	sm: { minHeight: sizeVars['--size-element-sm'] },
	md: { minHeight: sizeVars['--size-element-md'] },
	lg: { minHeight: sizeVars['--size-element-lg'] }
});

// The hover background fills the tab (inset 0) and is never shorter than the
// element size.
const hoverSizeStyles = stylex.create({
	sm: { minHeight: sizeVars['--size-element-sm'] },
	md: { minHeight: sizeVars['--size-element-md'] },
	lg: { minHeight: sizeVars['--size-element-lg'] }
});

const layoutStyles = stylex.create({
	// A hugging tab keeps its label's width. Without this the strip's flex
	// shrinks every tab below its text before overflow can scroll, and on a
	// narrow screen the labels draw over one another.
	hug: {
		flexShrink: 0
	},
	fill: {
		flex: 1,
		justifyContent: 'center'
	}
});

const iconSizeStyles = stylex.create({
	sm: { width: '14px', height: '14px' },
	md: { width: '16px', height: '16px' },
	lg: { width: '18px', height: '18px' }
});

/** The tab itself — a `<button>`, or the resolved link component with `href`. */
export function tabAttrs(
	size: TabListSize,
	isSelected: boolean,
	isFill: boolean,
	isDisabled: boolean,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return focusOutlineProps.focusVisible(
		styles.base,
		sizeStyles[size],
		isSelected && styles.selected,
		isFill ? layoutStyles.fill : layoutStyles.hug,
		!isDisabled && tabScope,
		// The touch press's strength and release live on the tab the controller
		// writes to; the hover layer inherits and paints it.
		!isDisabled && interactionOverlayStyles.pressedAlpha,
		xstyle
	);
}

/** The absolutely-positioned hover pill behind the tab's content. */
export function tabHoverBgAttrs(size: TabListSize): SvelteStyleAttrs {
	return sx(styles.hoverBg, hoverSizeStyles[size]);
}

/** The 2px selected-state rule along the tab's bottom edge. */
export function tabIndicatorAttrs(isSelected: boolean): SvelteStyleAttrs {
	return sx(styles.indicator, isSelected ? styles.indicatorSelected : styles.indicatorUnselected);
}

/** The icon slot, sized to the strip. */
export function tabIconAttrs(size: TabListSize): SvelteStyleAttrs {
	return sx(styles.icon, iconSizeStyles[size]);
}

/**
 * The label's grid wrapper. Its two cells overlap so the hidden semibold copy
 * reserves the selected width and the tab never resizes on selection.
 */
export function tabLabelContainerAttrs(): SvelteStyleAttrs {
	return sx(styles.labelContainer);
}

/** The visible label cell. */
export function tabLabelTextAttrs(): SvelteStyleAttrs {
	return sx(styles.labelText);
}

/** The invisible semibold cell that reserves the selected width. */
export function tabLabelSizerAttrs(): SvelteStyleAttrs {
	return sx(styles.labelSizer);
}

/** The trailing slot (badge, status dot). */
export function tabEndContentAttrs(): SvelteStyleAttrs {
	return sx(styles.endContentWrapper);
}
