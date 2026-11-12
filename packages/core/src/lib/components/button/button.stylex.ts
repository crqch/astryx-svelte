import * as stylex from '@stylexjs/stylex';
import {
	borderVars,
	colorVars,
	durationVars,
	easeVars,
	focusVars,
	fontWeightVars,
	radiusVars,
	shadowVars,
	sizeVars,
	spacingVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';
import { iconBoxStyle } from '../icon/icon.stylex.js';
import { interactionOverlayStyles } from '../../utils/interaction-overlay.stylex.js';
import { groupStyles as inputGroupStyles } from '../input-group/group-styles.stylex.js';
import {
	controlPressLayerStyles,
	rowPressLayerStyles
} from '../../private-attributes/press.stylex.js';
import type { Elevation } from '../../internal/types.js';
import type { ButtonGroupContextValue } from '../../internal/contexts.svelte.js';

/**
 * Extensible variant map for Button.
 *
 * Theme packages add their own variants by augmenting this interface:
 *
 * @example
 * declare module '@astryx-sv/core' {
 *   interface ButtonVariantMap {
 *     'primary-muted': true;
 *   }
 * }
 */
export interface ButtonVariantMap {
	primary: true;
	secondary: true;
	ghost: true;
	destructive: true;
}

/** Button variant. Extensible via {@link ButtonVariantMap}. */
export type ButtonVariant = keyof ButtonVariantMap;
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Written by the press controller or a group's tracker while a press is
 * believed. Typed `string`, so StyleX reads it as a computed key.
 */
const PRESSED_ON: string = '[data-astryx-press="on"]';

/**
 * Base button styles.
 *
 * Pseudo-classes are nested within properties per StyleX's recommendation, which
 * is also how Astryx authors them.
 */
const styles = stylex.create({
	base: {
		// Kept as a public themeable var (documented in Button.doc.mjs) even though
		// it now defaults to the shared token: removing it would break any theme
		// setting it, for no gain. It overrides the shared offset, so a theme can
		// still tune the ring distance on buttons specifically.
		'--button-focus-offset': focusVars['--focus-outline-offset'],
		outlineOffset: {
			default: '0',
			':focus-visible': 'var(--button-focus-offset)'
		},
		position: 'relative',
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacingVars['--spacing-2'],
		paddingBlock: spacingVars['--spacing-2'],
		paddingInline: spacingVars['--spacing-3'],
		borderWidth: 0,
		borderStyle: 'none',
		borderRadius: `var(--_button-radius, ${radiusVars['--radius-element']})`,
		fontFamily: 'inherit',
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
		fontWeight: fontWeightVars['--font-weight-medium'],
		whiteSpace: 'nowrap',
		// One line by construction, so a label wider than the space available
		// has to truncate. As a flex item the automatic minimum size would hold
		// the button at its full label width (and `nowrap` lets an inline button
		// run past its container), so the label's ellipsis never engaged. These
		// let a row shrink the button and cap it at its container.
		minWidth: 0,
		maxWidth: '100%',
		cursor: {
			default: 'pointer',
			':is(:disabled,[aria-disabled="true"])': 'default'
		},
		transitionProperty: 'background-image, background-color, color, opacity, transform',
		transitionDuration: {
			default: durationVars['--duration-fast'],
			'@media (prefers-reduced-motion: reduce)': '0s'
		},
		transitionTimingFunction: easeVars['--ease-standard']
	},
	pressable: {
		transform: {
			default: 'scale(1)',
			// A mouse press. Under a coarse pointer `:active` is not a press (it
			// paints on the touch and outlives a scroll), so the touch press model
			// writes `data-astryx-press` instead; see interaction-overlay.stylex.ts.
			':active:where(:not(:disabled,[aria-disabled="true"]))': {
				default: 'scale(0.98)',
				'@media (pointer: coarse)': 'scale(1)',
				// Under reduced motion a press never scales the button. The overlay
				// alone shows the press.
				'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': 'scale(1)',
				'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': 'scale(1)'
			},
			[PRESSED_ON]: {
				default: 'scale(0.98)',
				'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': 'scale(1)',
				'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': 'scale(1)'
			}
		}
	},
	// A tracked action's own `:active` image paints nothing: the tracker paints
	// the action under the pointer, which need not be the one pressed first.
	trackedOverlay: {
		backgroundSize: { default: null, [`:active:not(${PRESSED_ON})`]: '0 0' }
	},
	// A tracked action's press is painted by its group's tracker alone.
	pressableTracked: {
		transform: {
			default: 'scale(1)',
			[PRESSED_ON]: {
				default: 'scale(0.98)',
				'@media (prefers-reduced-motion: reduce) and (pointer: coarse)': 'scale(1)',
				'@media (prefers-reduced-motion: reduce) and (not (pointer: coarse))': 'scale(1)'
			}
		}
	},
	inactive: {
		cursor: 'default',
		backgroundImage: 'none',
		transform: {
			default: 'none',
			':active': 'none',
			[PRESSED_ON]: 'none'
		}
	},
	disabled: {
		opacity: 0.5
	},
	ariaDisabled: {
		// The variants' hover treatment already steps aside for
		// `[aria-disabled]`; `:active` still matches a press on an aria-disabled
		// button, so that one is suppressed here.
		backgroundImage: {
			default: 'none',
			':active': 'none',
			[PRESSED_ON]: 'none'
		}
	},
	iconOnly: {
		'--button-icon-only-aspect': '1 / 1',
		aspectRatio: 'var(--button-icon-only-aspect)',
		paddingInline: 0,
		paddingBlock: 0,
		// An icon-only button has no label to truncate: keep it square rather
		// than letting a crowded row squeeze it.
		flexShrink: 0,
		maxWidth: 'none'
	},
	endContentWrapper: {
		display: 'inline-flex',
		alignItems: 'center',
		color: 'inherit'
	},
	iconWrapper: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0
	},
	// A real box, not `display: contents`: WebKit before macOS 15 drops an
	// accessible name computed through a `display: contents` element, so
	// VoiceOver read a labelled Button as unnamed. The box takes the Button's
	// own layout (it is the only in-flow child; the spinner overlay and the
	// live region are absolutely positioned), so the content sits as before.
	contentWrapper: {
		display: 'flex',
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: 'auto',
		alignSelf: 'stretch',
		flexDirection: 'inherit',
		flexWrap: 'inherit',
		alignItems: 'inherit',
		justifyContent: 'inherit',
		gap: 'inherit',
		// Lets a narrow row shrink the box, so the label inside still truncates.
		minWidth: 0
	},
	labelText: {
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		minWidth: 0
	},
	link: {
		textDecoration: 'none'
	}
});

/**
 * Resting elevation, new in 0.1.9. Suppressed inside a `ButtonGroup`, which
 * carries the shadow for the whole group instead — see `buttonAttrs`.
 */
const elevationStyles = stylex.create({
	none: { boxShadow: 'none' },
	low: { boxShadow: shadowVars['--shadow-low'] },
	med: { boxShadow: shadowVars['--shadow-med'] },
	high: { boxShadow: shadowVars['--shadow-high'] }
});

// Consumer-controlled width. StyleX treats numbers as pixels; strings such as
// '100%' pass through unchanged.
const dynamicStyles = stylex.create({
	width: (width: string | number | null) => ({ width })
});

const sizeStyles = stylex.create({
	sm: { height: `max(${sizeVars['--size-element-sm']}, 1lh)` },
	md: { height: `max(${sizeVars['--size-element-md']}, 1lh)` },
	lg: { height: `max(${sizeVars['--size-element-lg']}, 1lh)` }
});

/**
 * An icon-only button holds its glyph, which does not grow with the text, so
 * it keeps a fixed square size.
 */
const iconOnlySizeStyles = stylex.create({
	sm: { height: sizeVars['--size-element-sm'] },
	md: { height: sizeVars['--size-element-md'] },
	lg: { height: sizeVars['--size-element-lg'] }
});

/** Icon sizing per button size — matches Icon: sm/md = 16px, lg = 20px.
 *  fontSize is set so emoji and text-based icons scale correctly. */

/**
 * Variant styles. The hover/pressed overlay is a stacked linear-gradient on top
 * of the base colour rather than a colour swap, so a single overlay token works
 * across every variant. The focus outline tracks the variant — destructive
 * focuses in its own negative colour.
 */
const variants = stylex.create({
	primary: {
		backgroundColor: colorVars['--color-accent'],
		color: colorVars['--color-on-accent']
	},
	secondary: {
		backgroundColor: colorVars['--color-neutral'],
		color: colorVars['--color-text-primary']
	},
	ghost: {
		backgroundColor: 'transparent',
		color: colorVars['--color-text-primary']
	},
	destructive: {
		backgroundColor: colorVars['--color-error'],
		color: colorVars['--color-on-error'],
		// Forced colors replace the fill with ButtonFace; a border keeps the
		// destructive fill's shape visible. A border, not an outline, leaves the
		// shared focus ring intact.
		borderWidth: { default: 0, '@media (forced-colors: active)': '1px' },
		borderStyle: { default: 'none', '@media (forced-colors: active)': 'solid' },
		borderColor: { default: null, '@media (forced-colors: active)': 'CanvasText' },
		// The ring matches the variant it rings: an accent-colored outline on a
		// red button reads as another control's focus. Only the color differs —
		// width, style and offset come from the shared outline.
		outlineColor: { default: null, ':focus-visible': colorVars['--color-error'] }
	}
});

const spinnerReveal = stylex.keyframes({
	from: { opacity: 0 },
	to: { opacity: 1 }
});

const contentHide = stylex.keyframes({
	from: { color: 'inherit' },
	to: { color: 'transparent' }
});

/**
 * Hold the loading swap briefly so a fast action that settles within the delay
 * never flashes a spinner. The spinner fade-in and the content hide share the
 * delay so the button never shows an empty frame between them. Reduced motion is
 * instant.
 */
const SPINNER_DELAY = durationVars['--duration-medium-min'];

const loadingStyles = stylex.create({
	// Hide the button's own content while the spinner overlay shows. Applied to
	// the content wrapper rather than the button so the button keeps its variant
	// foreground colour, which the spinner inherits via shade="inherit".
	hiddenContent: {
		color: 'transparent'
	},
	// Delayed variant: keep content visible, then hide it in lockstep with the
	// spinner reveal once the delay elapses.
	hiddenContentDelayed: {
		animationName: contentHide,
		animationDuration: '1ms',
		animationFillMode: 'forwards',
		animationDelay: {
			default: SPINNER_DELAY,
			'@media (prefers-reduced-motion: reduce)': '0s'
		}
	},
	spinnerOverlay: {
		position: 'absolute',
		top: 0,
		insetInlineStart: 0,
		insetInlineEnd: 0,
		bottom: 0,
		display: 'grid',
		placeItems: 'center'
	},
	spinnerDelayed: {
		animationName: spinnerReveal,
		animationDuration: durationVars['--duration-fast'],
		animationFillMode: 'backwards',
		animationDelay: {
			default: SPINNER_DELAY,
			'@media (prefers-reduced-motion: reduce)': '0s'
		}
	}
});

/**
 * "I am the last member of the group" — the trailing end cap.
 *
 * Not `:last-child`: several members render an invisible layer element after
 * their button (a tooltip'd Button renders button + layer; DropdownMenu renders
 * trigger + popover), so the layer would take the `:last-child` slot and the real
 * trailing button would keep square corners. Layers always carry the native
 * `popover` attribute and are never in-flow. Context layers also retain an inert
 * `<template>` marker so they can re-resolve their position. Neither element is a
 * group member, so "last member" means: no following element sibling besides
 * those two pieces of layer infrastructure.
 */
const IS_LAST_ITEM = ':nth-last-child(1 of :not([popover]):not(template):not(dialog))';

const groupStyles = stylex.create({
	horizontal: {
		borderStartStartRadius: { default: 0, ':first-child': radiusVars['--radius-element'] },
		borderEndStartRadius: { default: 0, ':first-child': radiusVars['--radius-element'] },
		borderStartEndRadius: { default: 0, [IS_LAST_ITEM]: radiusVars['--radius-element'] },
		borderEndEndRadius: { default: 0, [IS_LAST_ITEM]: radiusVars['--radius-element'] },
		borderInlineStartWidth: { default: borderVars['--border-width'], ':first-child': 0 },
		borderInlineStartStyle: { default: 'solid', ':first-child': 'none' },
		borderInlineStartColor: colorVars['--color-border']
	},
	vertical: {
		borderStartStartRadius: { default: 0, ':first-child': radiusVars['--radius-element'] },
		borderStartEndRadius: { default: 0, ':first-child': radiusVars['--radius-element'] },
		borderEndStartRadius: { default: 0, [IS_LAST_ITEM]: radiusVars['--radius-element'] },
		borderEndEndRadius: { default: 0, [IS_LAST_ITEM]: radiusVars['--radius-element'] },
		borderBlockStartWidth: { default: borderVars['--border-width'], ':first-child': 0 },
		borderBlockStartStyle: { default: 'solid', ':first-child': 'none' },
		borderBlockStartColor: colorVars['--color-border']
	},
	// Between two solid-filled members the neutral border disappears into the
	// fill, so the divider switches to the on-accent colour to stay visible.
	onSolidHorizontal: {
		borderInlineStartColor: colorVars['--color-on-accent']
	},
	onSolidVertical: {
		borderBlockStartColor: colorVars['--color-on-accent']
	}
});

export interface ButtonRootStyleInput {
	variant: ButtonVariant;
	size: ButtonSize;
	isIconOnly: boolean;
	isDisabled: boolean;
	/**
	 * Whether the button is disabled via `aria-disabled` rather than the native
	 * attribute — the branch a `tooltip` takes, so a disabled button stays
	 * focusable and its tooltip stays reachable. It suppresses the hover and
	 * active background changes the native `:disabled` state would have.
	 */
	isAriaDisabled: boolean;
	isLink: boolean;
	width: string | number | undefined;
	group: ButtonGroupContextValue | null;
	/** Whether the button is a direct member of an `InputGroup` (not a button group). */
	inInputGroup: boolean;
	/** Whether a tracking group's tracker paints this button's press. */
	isGroupTracked: boolean;
	/** Resting elevation. Ignored inside a group. */
	elevation: Elevation;
	xstyle?: StyleArg;
}

export function buttonRootAttrs(input: ButtonRootStyleInput): SvelteStyleAttrs {
	const {
		variant,
		size,
		isIconOnly,
		isDisabled,
		isAriaDisabled,
		isLink,
		width,
		group,
		inInputGroup,
		isGroupTracked,
		elevation,
		xstyle
	} = input;
	const horizontal = group?.orientation === 'horizontal';

	return focusOutlineProps.focusVisible(
		styles.base,
		isIconOnly ? iconOnlySizeStyles[size] : sizeStyles[size],
		isIconOnly && styles.iconOnly,
		// Upstream 0.5.1 moved the hover/pressed overlay off each variant into the
		// shared module. Position is upstream's: before `disabled`/`ariaDisabled`,
		// which still need to override it, and before `variants`, which no longer
		// carry a `backgroundImage` of their own.
		interactionOverlayStyles.backgroundImage,
		// The press the controller writes, on a layer under the label whose
		// release runs on the compositor.
		rowPressLayerStyles.cell,
		rowPressLayerStyles.cellOnImage,
		controlPressLayerStyles.control,
		isGroupTracked && styles.trackedOverlay,
		isDisabled && styles.inactive,
		isDisabled && styles.disabled,
		isAriaDisabled && styles.ariaDisabled,
		isLink && styles.link,
		!group && (isGroupTracked ? styles.pressableTracked : styles.pressable),
		group && (horizontal ? groupStyles.horizontal : groupStyles.vertical),
		inInputGroup && inputGroupStyles.buttonAddon,
		group &&
			(variant === 'primary' || variant === 'destructive') &&
			(horizontal ? groupStyles.onSolidHorizontal : groupStyles.onSolidVertical),
		// Standalone floating buttons only — a grouped button's elevation is owned
		// by the ButtonGroup, so the shared surface lifts as one unit instead of
		// each segment casting its own shadow onto its neighbours.
		!group && elevationStyles[elevation],
		width != null && dynamicStyles.width(width),
		// AFTER the shared focus outline: the outline supplies width/style/offset
		// for every variant, and `destructive` re-colors just the ring to match
		// its own surface. Ordering is the mechanism — StyleX is last-wins.
		variants[variant as keyof typeof variants],
		xstyle
	);
}

export function buttonContentAttrs(isLoading: boolean, delaySpinner: boolean): SvelteStyleAttrs {
	return sx(
		styles.contentWrapper,
		isLoading && (delaySpinner ? loadingStyles.hiddenContentDelayed : loadingStyles.hiddenContent)
	);
}

export function buttonSpinnerOverlayAttrs(delaySpinner: boolean): SvelteStyleAttrs {
	return sx(loadingStyles.spinnerOverlay, delaySpinner && loadingStyles.spinnerDelayed);
}

export function buttonIconAttrs(size: ButtonSize): SvelteStyleAttrs {
	return sx(styles.iconWrapper, iconBoxStyle(size === 'lg' ? 'md' : 'sm'));
}

export function buttonLabelAttrs(): SvelteStyleAttrs {
	return sx(styles.labelText);
}

export function buttonEndContentAttrs(): SvelteStyleAttrs {
	return sx(styles.endContentWrapper);
}
