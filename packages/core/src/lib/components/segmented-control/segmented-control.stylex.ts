import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import { colorVars, radiusVars, spacingVars } from '../../styles/tokens.stylex.js';
import type {
	SegmentedControlLayout,
	SegmentedControlSize
} from './segmented-control-context.svelte.js';

const styles = stylex.create({
	container: {
		position: 'relative',
		isolation: 'isolate',
		display: 'inline-flex',
		alignItems: 'center',
		// Hug sizes to its segments but never past its container: in a narrow
		// card or a phone row the segments shrink and their labels truncate
		// instead of the control running off the edge.
		width: 'fit-content',
		maxWidth: {
			default: 'none',
			':has([role="radio"]:not([aria-label]))': '100%'
		},
		minWidth: {
			default: 'auto',
			':has([role="radio"]:not([aria-label]))': 0
		},
		gap: spacingVars['--spacing-0-5'],
		'--_segmented-control-padding': spacingVars['--spacing-0-5'],
		padding: 'var(--_segmented-control-padding)',
		backgroundColor: colorVars['--color-neutral'],
		// A finger's horizontal drag carries the selected lens; a vertical one
		// still scrolls the page.
		touchAction: 'pan-y'
	},
	fill: {
		display: 'flex',
		width: '100%'
	},
	disabled: {
		opacity: 0.5,
		pointerEvents: 'none'
	},
	// Disabled *with* a disabledMessage: keep the dimmed look but leave pointer
	// events on so the group can receive hover and surface the reason tooltip.
	disabledWithMessage: {
		opacity: 0.5
	},
	// The selected face: one element under the segments, moved and resized
	// between their boxes. `transform` and the box's size are separate so the
	// lens can scale/move without a layout read per frame.
	lens: {
		'::before': {
			content: '""',
			position: 'absolute',
			zIndex: -1,
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: laid out on a segment's box measured from client rects (useSegmentedSelectionMotion), in both directions.
			left: 'var(--_segmented-lens-left, 0px)',
			top: 'var(--_segmented-lens-top, 0px)',
			width: 'var(--_segmented-lens-width, 0px)',
			height: 'var(--_segmented-lens-height, 0px)',
			boxSizing: 'border-box',
			// Scales around its center: the lens's position and size are separate.
			transformOrigin: '50% 50%',
			pointerEvents: 'none',
			visibility: 'var(--_segmented-lens-visibility, hidden)',
			willChange: 'var(--astryx-motion-will-change-before, auto)',
			// It carries a copy of an already resolved surface, forced colors
			// included (Highlight), so the UA must not remap it again.
			forcedColorAdjust: 'none',
			backgroundColor: 'var(--_segmented-lens-background-color, transparent)',
			backgroundImage: 'var(--_segmented-lens-background-image, none)',
			backgroundPosition: 'var(--_segmented-lens-background-position, 0% 0%)',
			backgroundSize: 'var(--_segmented-lens-background-size, auto)',
			backgroundRepeat: 'var(--_segmented-lens-background-repeat, repeat)',
			backgroundOrigin: 'var(--_segmented-lens-background-origin, padding-box)',
			backgroundClip: 'var(--_segmented-lens-background-clip, border-box)',
			boxShadow: 'var(--_segmented-lens-box-shadow, none)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderTopLeftRadius: 'var(--_segmented-lens-border-top-left-radius, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderTopRightRadius: 'var(--_segmented-lens-border-top-right-radius, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderBottomRightRadius: 'var(--_segmented-lens-border-bottom-right-radius, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderBottomLeftRadius: 'var(--_segmented-lens-border-bottom-left-radius, 0px)',
			borderTopWidth: 'var(--_segmented-lens-border-top-width, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderRightWidth: 'var(--_segmented-lens-border-right-width, 0px)',
			borderBottomWidth: 'var(--_segmented-lens-border-bottom-width, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderLeftWidth: 'var(--_segmented-lens-border-left-width, 0px)',
			borderTopStyle: 'var(--_segmented-lens-border-top-style, none)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderRightStyle: 'var(--_segmented-lens-border-right-style, none)',
			borderBottomStyle: 'var(--_segmented-lens-border-bottom-style, none)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderLeftStyle: 'var(--_segmented-lens-border-left-style, none)',
			borderTopColor: 'var(--_segmented-lens-border-top-color, currentcolor)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderRightColor: 'var(--_segmented-lens-border-right-color, currentcolor)',
			borderBottomColor: 'var(--_segmented-lens-border-bottom-color, currentcolor)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderLeftColor: 'var(--_segmented-lens-border-left-color, currentcolor)',
			backdropFilter: 'var(--_segmented-lens-backdrop-filter, none)',
			WebkitBackdropFilter: 'var(--_segmented-lens-webkit-backdrop-filter, none)'
		},
		'::after': {
			content: '""',
			position: 'absolute',
			zIndex: -1,
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: laid out on a segment's box measured from client rects (useSegmentedSelectionMotion), in both directions.
			left: 'var(--_segmented-after-left, 0px)',
			top: 'var(--_segmented-after-top, 0px)',
			width: 'var(--_segmented-after-width, 0px)',
			height: 'var(--_segmented-after-height, 0px)',
			boxSizing: 'border-box',
			// Scales around its center: the lens's position and size are separate.
			transformOrigin: '50% 50%',
			pointerEvents: 'none',
			visibility: 'var(--_segmented-after-visibility, hidden)',
			willChange: 'var(--astryx-motion-will-change-after, auto)',
			// It carries a copy of an already resolved surface, forced colors
			// included (Highlight), so the UA must not remap it again.
			forcedColorAdjust: 'none',
			backgroundColor: 'var(--_segmented-after-background-color, transparent)',
			backgroundImage: 'var(--_segmented-after-background-image, none)',
			backgroundPosition: 'var(--_segmented-after-background-position, 0% 0%)',
			backgroundSize: 'var(--_segmented-after-background-size, auto)',
			backgroundRepeat: 'var(--_segmented-after-background-repeat, repeat)',
			backgroundOrigin: 'var(--_segmented-after-background-origin, padding-box)',
			backgroundClip: 'var(--_segmented-after-background-clip, border-box)',
			boxShadow: 'var(--_segmented-after-box-shadow, none)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderTopLeftRadius: 'var(--_segmented-after-border-top-left-radius, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderTopRightRadius: 'var(--_segmented-after-border-top-right-radius, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderBottomRightRadius: 'var(--_segmented-after-border-bottom-right-radius, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderBottomLeftRadius: 'var(--_segmented-after-border-bottom-left-radius, 0px)',
			borderTopWidth: 'var(--_segmented-after-border-top-width, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderRightWidth: 'var(--_segmented-after-border-right-width, 0px)',
			borderBottomWidth: 'var(--_segmented-after-border-bottom-width, 0px)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderLeftWidth: 'var(--_segmented-after-border-left-width, 0px)',
			borderTopStyle: 'var(--_segmented-after-border-top-style, none)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderRightStyle: 'var(--_segmented-after-border-right-style, none)',
			borderBottomStyle: 'var(--_segmented-after-border-bottom-style, none)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderLeftStyle: 'var(--_segmented-after-border-left-style, none)',
			borderTopColor: 'var(--_segmented-after-border-top-color, currentcolor)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderRightColor: 'var(--_segmented-after-border-right-color, currentcolor)',
			borderBottomColor: 'var(--_segmented-after-border-bottom-color, currentcolor)',
			// eslint-disable-next-line astryx/no-physical-properties -- intentional: a copy of the segment's computed (physical) surface.
			borderLeftColor: 'var(--_segmented-after-border-left-color, currentcolor)',
			backdropFilter: 'var(--_segmented-after-backdrop-filter, none)',
			WebkitBackdropFilter: 'var(--_segmented-after-webkit-backdrop-filter, none)'
		}
	}
});

const sizeStyles = stylex.create({
	sm: {
		'--_segmented-control-radius': radiusVars['--radius-element'],
		borderRadius: 'var(--_segmented-control-radius)'
	},
	md: {
		'--_segmented-control-radius': radiusVars['--radius-element'],
		borderRadius: 'var(--_segmented-control-radius)'
	},
	lg: {
		'--_segmented-control-radius': radiusVars['--radius-element'],
		borderRadius: 'var(--_segmented-control-radius)'
	}
});

export interface SegmentedControlContainerOptions {
	size: SegmentedControlSize;
	layout: SegmentedControlLayout;
	isDisabled: boolean;
	showsDisabledMessage: boolean;
}

/** The radiogroup container styles. `xstyle` is threaded last. */
export function segmentedControlContainerAttrs(
	{ size, layout, isDisabled, showsDisabledMessage }: SegmentedControlContainerOptions,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	return sx(
		styles.container,
		styles.lens,
		sizeStyles[size],
		layout === 'fill' && styles.fill,
		isDisabled && (showsDisabledMessage ? styles.disabledWithMessage : styles.disabled),
		xstyle
	);
}
