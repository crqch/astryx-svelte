/**
 * @file use-popover-surface-motion.svelte.ts
 * @input The shared touch resolver, the layer runtime's presentation hold and
 *   popover-surface-motion
 * @output Exports `usePopoverSurfaceMotion`, the calls Popover makes as it
 *   opens and as it starts to close. Under a finger they present and dismiss
 *   the popover the UIKit way; a mouse keeps the layer's own entrance.
 * @position Internal to Popover; glue between the component and
 *   popover-surface-motion.ts
 *
 * Ported from Astryx's `Popover/usePopoverSurfaceMotion.ts`. Svelte has no
 * `useRef`, so the motion's cell is a plain `let`; unmount release is an
 * `$effect` cleanup where upstream uses an effect's return.
 */

import {
	createPopoverSurfaceMotion,
	type PopoverSurfaceMotion,
	type PopoverSurfaceRect
} from './popover-surface-motion.js';
import { createPresentationHold } from '../layer/presentation-hold.svelte.js';
import { isCoarsePointer } from '../../utils/coarse-pointer.js';

// The growth needs where the surface ends and where its source is. Both
// boxes are read once, in the frame that starts it, before that frame writes.
function boxOf(element: Element): PopoverSurfaceRect {
	const rect = element.getBoundingClientRect();
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height
	};
}

export interface PopoverSurfaceMotionCalls {
	/**
	 * Call as the popover opens, right after the browser shows it and before
	 * it paints. `entrance` is the surface that carries the pointer
	 * presentation's CSS entrance; the touch presentation turns it off there
	 * and plays its growth on it.
	 */
	present: (
		layer: HTMLElement | null,
		source: HTMLElement | null,
		entrance?: HTMLElement | null
	) => void;
	/** Call as the popover starts to close, while the browser still shows it. */
	closeStart: () => void;
}

export function usePopoverSurfaceMotion(): PopoverSurfaceMotionCalls {
	let motionRef: {
		element: HTMLElement;
		entrance: HTMLElement | null;
		motion: PopoverSurfaceMotion;
	} | null = null;
	// Whether the presentation in progress is the touch one, held from the
	// open until its close begins (Layer/presentation-hold).
	const touchHold = createPresentationHold<boolean>();

	const release = () => {
		motionRef?.motion.dispose();
		motionRef = null;
	};

	const motionFor = (element: HTMLElement, entrance: HTMLElement | null) => {
		const current = motionRef;
		if (current?.element === element && current.entrance === entrance) {
			return current.motion;
		}
		current?.motion.dispose();
		const motion = createPopoverSurfaceMotion(element, { entrance });
		motionRef = { element, entrance, motion };
		return motion;
	};

	// Releases the motion's compositor animations, and any exit copy still on
	// screen, at unmount.
	$effect(() => release);

	const present = (
		layer: HTMLElement | null,
		source: HTMLElement | null,
		entrance: HTMLElement | null = null
	) => {
		if (layer == null) {
			return;
		}
		const isTouch = source != null && isCoarsePointer(layer.ownerDocument.defaultView);
		touchHold.take(isTouch);
		if (!isTouch || source == null) {
			// A fine pointer animates nothing here, so nothing is created for
			// it, and nothing is promoted to the compositor. A motion this layer
			// already has (the pointer changed, or a touch presentation is on
			// screen) is released.
			release();
			return;
		}
		const surface = entrance ?? layer;
		motionFor(surface, entrance).enter(() => ({
			surface: boxOf(surface),
			source: boxOf(source)
		}));
	};

	const closeStart = () => {
		if (touchHold.current() === true) {
			motionRef?.motion.exit();
		}
		touchHold.release();
	};

	return { present, closeStart };
}
