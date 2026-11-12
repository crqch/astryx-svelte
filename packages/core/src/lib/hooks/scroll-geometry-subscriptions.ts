/**
 * Private observation of the canonical scroll owner.
 *
 * Ported from Astryx's `hooks/scrollGeometrySubscriptions.ts`.
 */

type GeometryListener = (hasContentInvalidation: boolean, hasLayoutInvalidation: boolean) => void;

const listeners = new WeakMap<HTMLElement, Set<GeometryListener>>();

export function subscribeScrollGeometry(
	viewport: HTMLElement,
	listener: GeometryListener
): () => void {
	let set = listeners.get(viewport);
	if (set == null) {
		set = new Set();
		listeners.set(viewport, set);
	}
	set.add(listener);
	return () => {
		set?.delete(listener);
		if (set?.size === 0) listeners.delete(viewport);
	};
}

export function publishScrollGeometry(
	viewport: HTMLElement,
	hasContentInvalidation = false,
	hasLayoutInvalidation = false
): void {
	for (const listener of listeners.get(viewport) ?? []) {
		listener(hasContentInvalidation || hasLayoutInvalidation, hasLayoutInvalidation);
	}
}
