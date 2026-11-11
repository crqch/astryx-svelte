import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	shadowVars,
	spacingVars
} from '../../styles/tokens.stylex.js';
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
		position: 'absolute',
		// The lens is placed from client rects in physical coordinates; both
		// writing directions use the same measured box.
		// eslint-disable-next-line astryx/no-physical-properties -- measured box
		left: 0,
		// eslint-disable-next-line astryx/no-physical-properties -- measured box
		top: 0,
		zIndex: -1,
		pointerEvents: 'none',
		boxSizing: 'border-box',
		borderRadius:
			'max(0px, calc(var(--_segmented-control-radius) - var(--_segmented-control-padding)))',
		backgroundColor: colorVars['--color-background-surface'],
		boxShadow: shadowVars['--shadow-low'],
		willChange: 'transform, width, height',
		transitionProperty: 'transform, width, height',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
		'@media (prefers-reduced-motion: reduce)': {
			transitionDuration: '0s'
		},
		// High contrast paints the selected segment itself (the selected item's
		// forced-colors background); the lens would double it.
		'@media (forced-colors: active)': {
			display: 'none'
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
		sizeStyles[size],
		layout === 'fill' && styles.fill,
		isDisabled && (showsDisabledMessage ? styles.disabledWithMessage : styles.disabled),
		xstyle
	);
}

/** The moving selected face. Position, size and transition suppression are inline. */
export function segmentedControlLensAttrs(): SvelteStyleAttrs {
	return sx(styles.lens);
}
