import { TOUCH_QUERY } from './touch-queries.js';

/**
 * Ported from Astryx's `utils/coarsePointer.ts`.
 *
 * The coarse-pointer gate of the press controller and the entrance hold. The
 * answer can change while the page is open, so a holder watches it.
 */

/** Whether the primary pointer of `view` is coarse now. */
export function isCoarsePointer(view: Window | null | undefined): boolean {
	return matchesMediaQuery(view, TOUCH_QUERY);
}

/** Whether `query` matches in `view` now. */
export function matchesMediaQuery(view: Window | null | undefined, query: string): boolean {
	return typeof view?.matchMedia === 'function' && view.matchMedia(query).matches;
}

/** Call `listener` with the new answer each time `query` starts or stops matching. */
export function watchMediaQuery(
	view: Window | null | undefined,
	query: string,
	listener: (matches: boolean) => void
): () => void {
	if (typeof view?.matchMedia !== 'function') return () => {};
	const list = view.matchMedia(query);
	const onChange = (): void => listener(list.matches);
	if (typeof list.addEventListener === 'function') {
		list.addEventListener('change', onChange);
		return () => list.removeEventListener('change', onChange);
	}
	list.addListener(onChange);
	return () => list.removeListener(onChange);
}

/** Call `listener` each time the primary pointer of `view` turns coarse or fine. */
export function watchCoarsePointer(
	view: Window | null | undefined,
	listener: (isCoarse: boolean) => void
): () => void {
	return watchMediaQuery(view, TOUCH_QUERY, listener);
}
