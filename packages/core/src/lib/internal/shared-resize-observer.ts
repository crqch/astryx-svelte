/**
 * Ported from Astryx's `src/utils/sharedResizeObserver.ts` — it is pure DOM code
 * with no React in it.
 *
 * A single `ResizeObserver` can watch thousands of elements, and browsers batch
 * delivery per observer instance. One observer per component (per table cell,
 * say) means N callback dispatches per frame instead of one, so every consumer
 * shares this singleton.
 */

type ResizeCallback = (entry: ResizeObserverEntry) => void;

let observer: ResizeObserver | null = null;
// A callback may be registered more than once for one element. The inner map
// keeps those registrations alive independently without dispatching duplicate
// work for the same callback reference.
const callbacks = new Map<Element, Map<ResizeCallback, number>>();

/**
 * The shared observer, or null where the API does not exist (jsdom, an old
 * browser). Callers still get the one-shot measurement `observeResize` fires
 * on registration; live resize updates are the part that needs the API.
 */
function getObserver(): ResizeObserver | null {
	if (typeof ResizeObserver === 'undefined') return null;
	if (!observer) {
		observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const targetCallbacks = callbacks.get(entry.target);
				if (targetCallbacks) {
					// A callback may unsubscribe while dispatch is in progress.
					for (const cb of [...targetCallbacks.keys()]) cb(entry);
				}
			}
		});
	}
	return observer;
}

/** Whether the shared observer already watches `element`. Internal. */
export function isResizeObserved(element: Element): boolean {
	return callbacks.has(element);
}

/**
 * Observe an element's size via the shared observer.
 *
 * Fires `callback` once synchronously on registration with a synthetic entry,
 * so callers need no separate initial-measurement path.
 *
 * Returns an unsubscribe function that removes only this registration, leaving
 * every other observer of the same element intact — prefer it over
 * {@link unobserveResize}, which drops them all.
 */
export function observeResize(element: Element, callback: ResizeCallback): () => void {
	const existing = callbacks.get(element);
	if (existing) existing.set(callback, (existing.get(callback) ?? 0) + 1);
	else callbacks.set(element, new Map([[callback, 1]]));
	getObserver()?.observe(element);

	const entry: Partial<ResizeObserverEntry> = { target: element };
	callback(entry as ResizeObserverEntry);

	let isSubscribed = true;
	return () => {
		if (!isSubscribed) return;
		isSubscribed = false;
		unobserveResize(element, callback);
	};
}

/**
 * Stop observing an element. Pass the callback to remove only that
 * registration; omitting it removes every callback on the element.
 */
export function unobserveResize(element: Element, callback?: ResizeCallback): void {
	const targetCallbacks = callbacks.get(element);
	if (callback != null) {
		const registrationCount = targetCallbacks?.get(callback);
		if (targetCallbacks == null || registrationCount == null) return;
		if (registrationCount > 1) {
			targetCallbacks.set(callback, registrationCount - 1);
			return;
		}
		targetCallbacks.delete(callback);
		if (targetCallbacks.size > 0) return;
	}
	callbacks.delete(element);
	if (observer) {
		observer.unobserve(element);
		if (callbacks.size === 0) {
			observer.disconnect();
			observer = null;
		}
	}
}
