/**
 * Ported from Astryx's `SegmentedControl/useSegmentedTouchTracking.ts`, the
 * geometry and target resolution the control's pointer handling shares.
 *
 * The React hook's press tracker/action-group half is replaced in this port by
 * the container's pointer handlers; the rules a finger follows — which segment
 * a point counts for and whether a lift is inside the control — are these
 * functions, unchanged.
 */

import { SEGMENT_SELECTOR } from './segmented-selection-motion.js';

/** The segments, in DOM order. */
export { SEGMENT_SELECTOR };

/** The control's box as measured when the finger landed: viewport px. */
export interface ControlBounds {
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
}

/** A segment as measured when the finger landed: its viewport span, px. */
export interface SegmentSpan {
	readonly element: HTMLElement;
	readonly left: number;
	readonly right: number;
}

/** A tap's click still to come. */
export interface ClickWait {
	readonly isAwaiting: () => boolean;
	readonly end: () => void;
}

/** Every segment of `track`, disabled ones included, measured once. */
export function measureSegments(track: HTMLElement): SegmentSpan[] {
	return Array.from(track.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR), (element) => {
		const rect = element.getBoundingClientRect();
		return { element, left: rect.left, right: rect.right };
	});
}

function isDisabled(element: HTMLElement): boolean {
	return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
}

/**
 * The segment a finger at viewport `x` counts for: the one under it, else the
 * nearest. A gap between two segments splits at its middle, as UIKit's
 * segments share an edge. Past the ends, the end segment counts. The result is
 * null when that segment is disabled.
 */
export function segmentTargetAt(
	x: number,
	segments: ReadonlyArray<SegmentSpan>
): HTMLElement | null {
	let best: SegmentSpan | null = null;
	let distance = Infinity;
	for (const segment of segments) {
		const d = Math.max(segment.left - x, 0, x - segment.right);
		if (d < distance) {
			distance = d;
			best = segment;
		}
	}
	return best != null && !isDisabled(best.element) ? best.element : null;
}

/**
 * The segment a lift at viewport (`x`, `y`) commits: inside any box of the
 * control's lift `area`, the one `segmentTargetAt` counts it for; outside
 * them, none. A press that slides off cancels.
 */
export function liftTargetAt(
	x: number,
	y: number,
	area: ReadonlyArray<ControlBounds>,
	segments: ReadonlyArray<SegmentSpan>
): HTMLElement | null {
	const isInside = area.some(
		(box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
	);
	return isInside ? segmentTargetAt(x, segments) : null;
}

/**
 * The boxes a lift may commit in: the control's own box, and each segment's
 * box (this port has no touch hit-band insets).
 */
export function measureLiftArea(
	track: HTMLElement,
	segments: ReadonlyArray<SegmentSpan>
): ReadonlyArray<ControlBounds> {
	const { left, top, right, bottom } = track.getBoundingClientRect();
	return [
		{ left, top, right, bottom },
		...segments.map(({ element }) => {
			const box = element.getBoundingClientRect();
			return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
		})
	];
}
