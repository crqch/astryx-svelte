import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { focusOutlineProps } from '../../utils/focus-outline.stylex.js';
import { rtlStyles } from '../../utils/rtl.stylex.js';
import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	spacingVars
} from '../../styles/tokens.stylex.js';

/**
 * `ResizeHandle`'s styles, ported from Astryx's `ResizeHandle.tsx`.
 *
 * The handle *is* the divider line — 1px in the layout — with a wider
 * absolutely-positioned hit area over it, so the grab zone is comfortable
 * without the separator taking any space.
 */

/** Which side of the divider line the pill grip sits on. */
export type PillPlacement = 'start' | 'end' | 'center' | 'auto';

/**
 * `'auto'` puts the pill on the panel's side, and flips it when the panel
 * collapses to 0px so the grip stays reachable.
 */
export function resolveEffectiveSide(
	pillPlacement: PillPlacement,
	isReversed: boolean,
	isCollapsed: boolean
): 'start' | 'end' | 'center' {
	if (pillPlacement !== 'auto') {
		return pillPlacement;
	}
	const panelSide: 'start' | 'end' = isReversed ? 'end' : 'start';
	if (isCollapsed) {
		return panelSide === 'start' ? 'end' : 'start';
	}
	return panelSide;
}

const styles = stylex.create({
	handle: {
		position: 'relative',
		// The grab zone and the pill stay above the content beside the handle. A
		// glide's translate makes the handle a stacking context, which traps
		// their own z-index inside it.
		zIndex: 2,
		flexShrink: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colorVars['--color-border'],
		transitionProperty: 'background-color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard']
	},
	// Overlay mode — absolutely positioned inside the parent panel
	// instead of being a sibling in flex flow. Used when the handle
	// must stay within a parent's overflow: clip bounds.
	overlay: {
		position: 'absolute',
		zIndex: 2,
		backgroundColor: 'transparent'
	},
	overlayHorizontal: {
		insetInlineEnd: 0,
		top: 0,
		bottom: 0,
		width: 'var(--resize-handle-hit-area, 16px)'
	},
	overlayVertical: {
		insetBlockEnd: 0,
		insetInlineStart: 0,
		insetInlineEnd: 0,
		height: 'var(--resize-handle-hit-area, 16px)'
	},
	overlayHorizontalOnShortPane: {
		width: 'min(var(--resize-handle-hit-area, 16px), 50%)'
	},
	overlayVerticalOnShortPane: {
		height: 'min(var(--resize-handle-hit-area, 16px), 50%)'
	},
	horizontal: {
		width: 1,
		height: '100%',
		cursor: {
			default: 'col-resize',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	vertical: {
		height: 1,
		width: '100%',
		cursor: {
			default: 'row-resize',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	noDividerHorizontal: {
		backgroundColor: 'transparent',
		width: 0
	},
	noDividerVertical: {
		backgroundColor: 'transparent',
		height: 0
	},
	handleHover: {
		backgroundColor: colorVars['--color-border']
	},
	handleActive: {
		backgroundColor: colorVars['--color-border-emphasized']
	},
	disabled: {
		cursor: 'default',
		pointerEvents: 'none'
	},

	hitArea: {
		position: 'absolute',
		zIndex: 1,
		touchAction: 'none',
		userSelect: 'none'
	},
	hitAreaHorizontal: {
		width: spacingVars['--spacing-4'],
		top: 0,
		bottom: 0,
		cursor: {
			default: 'col-resize',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	hitAreaVertical: {
		height: spacingVars['--spacing-4'],
		insetInlineStart: 0,
		insetInlineEnd: 0,
		cursor: {
			default: 'row-resize',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	// The grab zone sits centred on the Handle whatever `pillPlacement` says,
	// which only places the pill. Inline centering comes from
	// rtlStyles.centerInline at the call site (correct in LTR and RTL); this
	// block owns only the block axis.
	hitAreaCenteredY: {
		insetBlockStart: '50%',
		transform: 'translateY(-50%)'
	},
	hitAreaWithinHandleX: {
		width: `min(${spacingVars['--spacing-4']}, 100%)`
	},
	hitAreaWithinHandleY: {
		height: `min(${spacingVars['--spacing-4']}, 100%)`
	},

	// Pill base — themes target .astryx-resize-handle-pill for size/shape.
	pill: {
		position: 'absolute',
		zIndex: 2,
		touchAction: 'none',
		userSelect: 'none',
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: colorVars['--color-border'],
		transitionProperty: 'opacity, background-color, transform',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
		top: '50%'
	},
	pillGrabHorizontal: {
		cursor: {
			default: 'col-resize',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	pillGrabVertical: {
		cursor: {
			default: 'row-resize',
			':is(:disabled,[aria-disabled="true"])': 'default'
		}
	},
	pillHorizontal: {
		width: 3,
		height: spacingVars['--spacing-8']
	},
	pillVertical: {
		width: spacingVars['--spacing-8'],
		height: 3
	},
	// A hidden pill paints nothing, so it takes no pointer either.
	pillHidden: { opacity: 0, pointerEvents: 'none' },
	pillVisible: { opacity: 1 },
	pillHover: {
		opacity: 1,
		pointerEvents: 'auto',
		backgroundColor: colorVars['--color-border']
	},
	pillActive: {
		opacity: 1,
		pointerEvents: 'auto',
		backgroundColor: colorVars['--color-border-emphasized']
	},
	// A pill shown on hover can sit outside the Grab zone. This invisible
	// extension spans the gap toward the Handle, so the pointer keeps the hover
	// on its way to the pill. It reaches no further than the pill, and it takes
	// the pointer only while the pill does. The pill's offset is a physical
	// translate, so the side toward the Handle is physical too.
	pillBridgeRight: {
		'::before': {
			content: '""',
			position: 'absolute',
			insetBlock: 0,
			insetInlineStart: {
				default: 0,
				':is([dir="rtl"] *)': `calc(-1 * ${spacingVars['--spacing-1']} - 1px)`
			},
			insetInlineEnd: {
				default: `calc(-1 * ${spacingVars['--spacing-1']} - 1px)`,
				':is([dir="rtl"] *)': 0
			}
		}
	},
	pillBridgeLeft: {
		'::before': {
			content: '""',
			position: 'absolute',
			insetBlock: 0,
			insetInlineStart: {
				default: `calc(-1 * ${spacingVars['--spacing-1']} - 1px)`,
				':is([dir="rtl"] *)': 0
			},
			insetInlineEnd: {
				default: 0,
				':is([dir="rtl"] *)': `calc(-1 * ${spacingVars['--spacing-1']} - 1px)`
			}
		}
	},
	pillBridgeDown: {
		'::before': {
			content: '""',
			position: 'absolute',
			insetInline: 0,
			insetBlockStart: 0,
			insetBlockEnd: `calc(-1 * ${spacingVars['--spacing-1']} - 1px)`
		}
	},
	pillBridgeUp: {
		'::before': {
			content: '""',
			position: 'absolute',
			insetInline: 0,
			insetBlockStart: `calc(-1 * ${spacingVars['--spacing-1']} - 1px)`,
			insetBlockEnd: 0
		}
	}
});

// Dynamic styles — avoids inline style overrides.
// Each axis gets its own function since StyleX requires static structure.
const dynamicStyles = stylex.create({
	// An inline Handle's zone is centred on its line, so half of it reaches into
	// the pane.
	hitAreaLengthX: (pane: number) => ({
		width: `min(${spacingVars['--spacing-4']}, ${pane}px)`
	}),
	hitAreaLengthY: (pane: number) => ({
		height: `min(${spacingVars['--spacing-4']}, ${pane}px)`
	}),
	pillOffsetX: (dir: number) => ({
		insetInlineStart: 0,
		transform: `translate(calc(${dir} * (100% + ${spacingVars['--spacing-1']})), -50%)`
	}),
	// Vertical offset: no rotation — use explicit landscape dimensions.
	// Rotation + offset creates confusing coordinate math since translate
	// operates in pre-rotation local space.
	pillOffsetY: (dir: number) => ({
		top: 0,
		transform: `translate(-50%, calc(${dir} * (100% + ${spacingVars['--spacing-1']})))`
	})
});

export interface ResizeHandleAttrsOptions {
	isHorizontal: boolean;
	isOverlay: boolean;
	hasDivider: boolean;
	isInteracting: boolean;
	isDragging: boolean;
	isDisabled: boolean;
	/**
	 * The region's size, or `undefined` when there is none. A short pane gets the
	 * clamped overlay geometry, and an inline zone never reaches past half of it.
	 */
	paneLength: number | undefined;
}

export function resizeHandleAttrs(
	{
		isHorizontal,
		isOverlay,
		hasDivider,
		isInteracting,
		isDragging,
		isDisabled,
		paneLength
	}: ResizeHandleAttrsOptions,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return focusOutlineProps.focusVisible(
		styles.handle,
		isOverlay && styles.overlay,
		isOverlay && (isHorizontal ? styles.overlayHorizontal : styles.overlayVertical),
		isOverlay &&
			paneLength != null &&
			(isHorizontal ? styles.overlayHorizontalOnShortPane : styles.overlayVerticalOnShortPane),
		!isOverlay && (isHorizontal ? styles.horizontal : styles.vertical),
		!isOverlay &&
			!hasDivider &&
			(isHorizontal ? styles.noDividerHorizontal : styles.noDividerVertical),
		!isOverlay && hasDivider && isInteracting && !isDragging && styles.handleHover,
		!isOverlay && hasDivider && isDragging && styles.handleActive,
		isDisabled && styles.disabled,
		xstyle
	);
}

export interface ResizeHandleHitAreaAttrsOptions {
	isHorizontal: boolean;
	isOverlay: boolean;
	isDisabled: boolean;
	paneLength: number | undefined;
}

export function resizeHandleHitAreaAttrs({
	isHorizontal,
	isOverlay,
	isDisabled,
	paneLength
}: ResizeHandleHitAreaAttrsOptions): SvelteStyleAttrs {
	return sx(
		styles.hitArea,
		isHorizontal ? styles.hitAreaHorizontal : styles.hitAreaVertical,
		isHorizontal ? rtlStyles.centerInline('0px') : styles.hitAreaCenteredY,
		isOverlay && (isHorizontal ? styles.hitAreaWithinHandleX : styles.hitAreaWithinHandleY),
		!isOverlay &&
			paneLength != null &&
			(isHorizontal
				? dynamicStyles.hitAreaLengthX(paneLength)
				: dynamicStyles.hitAreaLengthY(paneLength)),
		isDisabled && styles.disabled
	);
}

export interface ResizeHandlePillAttrsOptions {
	isHorizontal: boolean;
	effectiveSide: 'start' | 'end' | 'center';
	isAlwaysVisible: boolean;
	isInteracting: boolean;
	isDragging: boolean;
	isDisabled: boolean;
}

export function resizeHandlePillAttrs({
	isHorizontal,
	effectiveSide,
	isAlwaysVisible,
	isInteracting,
	isDragging,
	isDisabled
}: ResizeHandlePillAttrsOptions): SvelteStyleAttrs {
	return sx(
		styles.pill,
		isHorizontal ? styles.pillHorizontal : styles.pillVertical,
		effectiveSide === 'center'
			? rtlStyles.centerInline('-50%')
			: isHorizontal
				? dynamicStyles.pillOffsetX(effectiveSide === 'start' ? -1 : 1)
				: dynamicStyles.pillOffsetY(effectiveSide === 'start' ? -1 : 1),
		isHorizontal ? styles.pillGrabHorizontal : styles.pillGrabVertical,
		isAlwaysVisible ? styles.pillVisible : styles.pillHidden,
		!isAlwaysVisible &&
			effectiveSide !== 'center' &&
			(isHorizontal
				? effectiveSide === 'start'
					? styles.pillBridgeRight
					: styles.pillBridgeLeft
				: effectiveSide === 'start'
					? styles.pillBridgeDown
					: styles.pillBridgeUp),
		isInteracting && !isDragging && styles.pillHover,
		isDragging && styles.pillActive,
		isDisabled && styles.disabled
	);
}
