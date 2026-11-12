import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { inputWrapperStyles } from '../field/input-styles.stylex.js';
import {
	colorVars,
	durationVars,
	easeVars,
	fontWeightVars,
	radiusVars,
	sizeVars,
	spacingVars,
	typeScaleVars,
	typographyVars
} from '../../styles/tokens.stylex.js';
import { focusOutlineStyles } from '../../utils/focus-outline.stylex.js';
import { interactionOverlayStyles } from '../../utils/interaction-overlay.stylex.js';
import { layerViewportInset } from '../layer/layer-viewport-inset.stylex.js';

/**
 * Ported from Astryx's `ComplexSelector/ComplexSelector.tsx`, where the styles
 * are inline in the component file rather than in a module of their own. The
 * group name (`styles`) is upstream's, so it needs no rename — and the three
 * size keys stay **inside** that group rather than moving to a `sizeStyles` of
 * their own, because upstream indexes them as `styles[size]` and the oracle
 * diffs `dist/`'s object key by key.
 *
 * The declarations read very close to `Selector`'s — same trigger container,
 * same chevron glyph — but they are a second, independent copy upstream, not a
 * shared module, so they are transcribed rather than imported. Where the two
 * genuinely differ is worth naming: this trigger carries `borderRadius`, the
 * container has no `variant`, and the popup content is a scrolling
 * `padding: --spacing-3` box instead of a listbox.
 *
 * **There is no local focus ring.** This module used to declare one
 * (`:focus-within { outline: 2px solid accent; outline-offset: 2px }`), which
 * was the CSS oracle's invented `.x1oqel4m:focus-within` / `.x1fanpfn` pair.
 * 0.4.x consolidated every ring into `focusOutlineStyles` (#4935, #4973), and
 * `focusWithin` there is `:has(:focus-visible)` — so it is also a *keyboard*
 * ring, where the old one drew on a mouse click too.
 */

/** Written by the press controller while it paints a press. */
const PRESSED_ON = '[data-astryx-press="on"]';

/** The content's own block-size cap, under the layer runtime's viewport cap. */
const CONTENT_BLOCK_CAP = '480px';

const styles = stylex.create({
	// The status glyph or info-tip keeps its size when the trigger text is long.
	statusTip: {
		display: 'inline-flex',
		alignItems: 'center',
		flexShrink: 0
	},
	triggerContainer: {
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacingVars['--spacing-2'],
		width: '100%',
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-3'],
		fontFamily: typographyVars['--font-family-body'],
		fontSize: {
			default: typeScaleVars['--text-label-size'],
			// The 16px floor is iOS-only: iOS Safari zooms the page when a focused
			// control sits under 16px, and only iOS WebKit implements
			// -webkit-touch-callout to key the coarse-pointer floor to it.
			'@media (pointer: coarse)': {
				'@supports (-webkit-touch-callout: none)': `max(1rem, ${typeScaleVars['--text-label-size']})`
			}
		},
		lineHeight: typeScaleVars['--text-label-leading'],
		color: colorVars['--color-text-primary'],
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	trigger: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacingVars['--spacing-2'],
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 0,
		minWidth: 0,
		padding: 0,
		margin: 0,
		borderWidth: 0,
		borderStyle: 'none',
		backgroundColor: 'transparent',
		fontFamily: 'inherit',
		fontSize: 'inherit',
		lineHeight: 'inherit',
		color: 'inherit',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		outline: 'none',
		borderRadius: radiusVars['--radius-element']
	},
	triggerText: {
		flexGrow: 1,
		minWidth: 0,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		textAlign: 'start'
	},
	placeholder: {
		color: colorVars['--color-text-secondary']
	},
	// Only what Icon does not already provide: `sm` gives the 16px box and
	// `color="secondary"` the color, but the glyph still must not shrink inside
	// the flex trigger.
	triggerIcon: {
		flexShrink: 0
	},
	// Rotation lives on the chevron glyph itself (passed through `xstyle`), not
	// on the layout wrapper above, so the icon's
	// `complex-selector-indicator-icon` theme target and the open/closed
	// transform sit on one element — a theme can restyle the mark and its
	// rotation through a single selector. The wrapper keeps only layout.
	triggerIconRotation: {
		transitionProperty: 'transform',
		// Under reduced motion the chevron turns at once: an in-place state
		// change moves nothing (design:reduced-motion DR1–DR3).
		transitionDuration: {
			default: durationVars['--duration-fast'],
			'@media (prefers-reduced-motion: reduce)': '0s'
		},
		transitionTimingFunction: easeVars['--ease-standard'],
		transformOrigin: 'center'
	},
	triggerIconOpen: {
		transform: 'rotate(180deg)'
	},
	popover: {
		minWidth: 'anchor-size(width)'
	},
	content: {
		boxSizing: 'border-box',
		// The content's own cap, under the layer runtime's viewport cap: the
		// viewport minus its gutters and any bar the app declares through
		// LayerProvider's `inset` (spec:AST-059 FR2, FR6), so the last rows never
		// paint under that bar.
		maxHeight: stylex.firstThatWorks(
			`min(${CONTENT_BLOCK_CAP}, ${layerViewportInset.maxBlockSize})`,
			`min(${CONTENT_BLOCK_CAP}, ${layerViewportInset.maxBlockSizeFallback})`
		),
		overflow: 'auto',
		padding: spacingVars['--spacing-3']
	},
	sm: {
		height: sizeVars['--size-element-sm']
	},
	md: {
		height: sizeVars['--size-element-md']
	},
	lg: {
		height: sizeVars['--size-element-lg']
	},
	// The ghost trigger drops the field chrome for a toolbar-button treatment:
	// no border, no shadow, a hover/press wash painted as a background image so it
	// composites over whatever surface it sits on.
	triggerGhost: {
		width: 'auto',
		borderWidth: 0,
		backgroundColor: 'transparent',
		boxShadow: {
			default: 'none',
			':hover:not(:focus-within):where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': 'none'
			},
			':focus-within': 'none'
		},
		fontWeight: fontWeightVars['--font-weight-medium'],
		transitionProperty: 'background-image, background-color, color, opacity, transform',
		transform: {
			default: 'scale(1)',
			// A mouse press; under a coarse pointer the touch press model writes
			// `data-astryx-press` instead (see interaction-overlay.stylex.ts).
			':active': {
				default: 'scale(0.98)',
				'@media (pointer: coarse)': 'scale(1)'
			},
			[PRESSED_ON]: 'scale(0.98)'
		}
	},
	triggerGhostDisabled: {
		backgroundImage: 'none',
		transform: {
			default: 'none',
			':active': 'none',
			[PRESSED_ON]: 'none'
		}
	},
	// Keep the input-family width contract while reusing ghost's borderless paint
	// and the neutral resting fill used by secondary buttons.
	triggerSecondary: {
		borderWidth: 0,
		backgroundColor: colorVars['--color-neutral'],
		boxShadow: {
			default: 'none',
			':hover:not(:focus-within):where(:not(:disabled,[aria-disabled="true"]))': {
				'@media (hover: hover)': 'none'
			},
			':focus-within': 'none'
		},
		fontWeight: fontWeightVars['--font-weight-medium'],
		transitionProperty: 'background-image, background-color, color, opacity, transform',
		transform: {
			default: 'scale(1)',
			':active': {
				default: 'scale(0.98)',
				'@media (pointer: coarse)': 'scale(1)'
			},
			[PRESSED_ON]: 'scale(0.98)'
		}
	},
	disabled: {
		cursor: 'default'
	}
});

/**
 * Trigger and field size.
 *
 * Declared here rather than in `complex-selector.svelte` because
 * `complexSelectorTriggerContainerAttrs` indexes the size styles with it — the
 * same arrangement `SelectorSize` and `MultiSelectorSize` take. Upstream
 * declares it in `ComplexSelector.tsx` beside the styles it gates, and spells
 * it out as a union rather than deriving it from a group, so this does too:
 * `sm`/`md`/`lg` share the group with every other key here.
 */
export type ComplexSelectorSize = 'sm' | 'md' | 'lg';

/** Visual trigger style. `secondary` matches secondary buttons; `ghost` toolbar buttons. */
export type ComplexSelectorVariant = 'input' | 'secondary' | 'ghost';

/**
 * The bordered surface wrapping the trigger button, spinner and chevron.
 *
 * `hasTriggerLabel` is upstream's `triggerLabel == null` test: the placeholder
 * colour applies to the *container*, not to the text span, so it has to be
 * decided here rather than where the text renders.
 */
export function complexSelectorTriggerContainerAttrs(
	size: ComplexSelectorSize,
	isDisabled: boolean,
	hasTriggerLabel: boolean,
	variant: ComplexSelectorVariant,
	xstyle: StyleArg
): SvelteStyleAttrs {
	return sx(
		inputWrapperStyles.base,
		styles.triggerContainer,
		styles[size],
		// The ring belongs to the wrapper (the focusable `<button>` sits inside
		// it), but it must still be a KEYBOARD ring: `:focus-within` matched a
		// mouse click on the trigger and drew the outline for pointer users too.
		// It keys off the trigger alone, so the status info-tip beside it rings
		// itself and the box does not ring too (architecture:interaction-modality
		// INV3).
		focusOutlineStyles.focusWithinCombobox,
		variant === 'secondary' && styles.triggerSecondary,
		variant === 'ghost' && styles.triggerGhost,
		// Upstream 0.5.1 moved the trigger's hover/pressed overlay into the
		// shared module, under the non-input gate and in upstream's position.
		variant !== 'input' && interactionOverlayStyles.backgroundImage,
		isDisabled && inputWrapperStyles.disabled,
		variant !== 'input' && isDisabled && styles.triggerGhostDisabled,
		isDisabled && styles.disabled,
		!hasTriggerLabel && styles.placeholder,
		xstyle
	);
}

/** The `aria-haspopup="dialog"` button itself. */
export function complexSelectorTriggerAttrs(): SvelteStyleAttrs {
	return sx(styles.trigger);
}

/** The truncating label span inside the trigger. */
export function complexSelectorTriggerTextAttrs(): SvelteStyleAttrs {
	return sx(styles.triggerText);
}

/**
 * `xstyle` for the chevron glyph: the no-shrink rule, the rotation transition,
 * and the flip while open. Handed to `Icon` so one element carries the mark, its
 * transform and the `complex-selector-indicator-icon` theme target.
 */
export function complexSelectorChevronXstyle(isOpen: boolean): StyleArg {
	return [styles.triggerIcon, styles.triggerIconRotation, isOpen && styles.triggerIconOpen];
}

/** The scrolling popup content box the render snippet fills. */
export function complexSelectorContentAttrs(contentXstyle: StyleArg): SvelteStyleAttrs {
	return sx(styles.content, contentXstyle);
}

/** The status glyph or info-tip inside the trigger, sized for the field. */
export function complexSelectorStatusTipAttrs(): SvelteStyleAttrs {
	return sx(styles.statusTip);
}

/**
 * `xstyle` for the layer container — upstream's `[styles.popover,
 * layerAnimations[placement]]`, whose second half the caller appends.
 */
export const complexSelectorPopoverStyle: StyleArg = styles.popover;

/**
 * The system's standard menu clearance, passed to `<PopoverLayer offset>`
 * (#4951). It replaces the `marginBlockStart` this module used to bake into
 * `popover`, which a `position-try-fallbacks` flip would have applied to the
 * wrong edge. A token cannot be read from a `.svelte` file, so it is re-exported
 * here — the arrangement `powerSearchPopoverOffset` settled.
 */
export const complexSelectorPopoverOffset: string = spacingVars['--spacing-1'];
