import { createPanGesture, type PanGestureOptions } from './create-pan-gesture.js';

/**
 * Ported from Astryx's `hooks/usePanGesture.ts`.
 *
 * The React hook keeps one pan on the element behind a ref, re-creates it when
 * the node or the axis changes, and reads `onPan` through a ref so a new
 * function re-creates nothing. Svelte's counterpart takes an element getter;
 * the effect re-runs on the node or the axis, and `onPan` is read from the
 * latest options at each event — no second layer of state.
 *
 * An effect never calls `onPan`: a drag in progress ends with no event when
 * the node or axis changes, or at unmount.
 */
export function usePanGesture(getElement: () => Element | null, options: PanGestureOptions): void {
	$effect(() => {
		const element = getElement();
		const axis = options.axis;
		if (element == null) {
			return;
		}
		let isForwarding = true;
		const gesture = createPanGesture(element, {
			axis,
			onPan: (event) => {
				if (isForwarding) options.onPan(event);
			}
		});
		return () => {
			isForwarding = false;
			gesture.destroy();
		};
	});
}
