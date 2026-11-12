/**
 * Ported from Astryx's `internal/useDismissSearchOnTouchDrag.ts`.
 *
 * A direct vertical touch drag on the results moves focus off a focused search
 * input. The on-screen keyboard then leaves and the rows come into view; the
 * query stays. Focus goes to the caller's target (the sheet's panel), never to
 * the page body behind an open modal. Small moves, taps and multi-touch
 * gestures leave focus alone.
 *
 * The React hook is `useRef` plus four handlers; the reference becomes a plain
 * closure variable, since it holds no rendered value.
 */

const DRAG_THRESHOLD_PX = 8;

export interface DismissSearchOnTouchDragHandlers {
	ontouchstart: (event: TouchEvent) => void;
	ontouchmove: (event: TouchEvent) => void;
	ontouchend: (event: TouchEvent) => void;
	ontouchcancel: (event: TouchEvent) => void;
}

export function useDismissSearchOnTouchDrag(
	getSearchInputs: () => ReadonlyArray<HTMLInputElement | null | undefined>,
	getFocusTarget?: () => HTMLElement | null | undefined
): DismissSearchOnTouchDragHandlers {
	let startY: number | null = null;
	const reset = (): void => {
		startY = null;
	};

	return {
		ontouchstart: (event) => {
			startY = event.touches.length === 1 ? event.touches[0].clientY : null;
		},
		ontouchmove: (event) => {
			if (event.touches.length !== 1) {
				reset();
				return;
			}
			if (startY == null || Math.abs(event.touches[0].clientY - startY) < DRAG_THRESHOLD_PX) {
				return;
			}
			reset();
			const focusedSearch = getSearchInputs().find(
				(input) => input != null && input === document.activeElement
			);
			if (focusedSearch == null) {
				return;
			}
			const target = getFocusTarget?.();
			if (target != null) {
				target.focus({ preventScroll: true });
			} else {
				focusedSearch.blur();
			}
		},
		ontouchend: reset,
		ontouchcancel: reset
	};
}
