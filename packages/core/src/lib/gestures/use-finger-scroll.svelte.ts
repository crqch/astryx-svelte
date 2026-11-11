import { getGestureHost } from './gesture-host.js';
import { isFingerScroll, watchFingerScrolls } from './finger-scroll.js';
import { isDocument } from '../utils/node-type.js';

/**
 * Ported from Astryx's `gestures/useFingerScroll.ts`.
 *
 * The React hook takes a ref (or the document) and keeps the watch on the node
 * it names after each commit. Svelte's counterpart takes a getter — the same
 * shape every rune hook in this port uses — and keeps the watch on whatever it
 * names in an effect, moving it when the node is replaced and releasing it on
 * unmount.
 *
 * Internal to the touch module: not exported from the gestures barrel, as
 * upstream.
 */

function documentOf(node: Element | Document): Document {
	return isDocument(node) ? node : node.ownerDocument;
}

export interface UseFingerScrollOptions {
	/**
	 * Runs each time a finger's scroll on the scroller ends, once the reader
	 * says `false`. Unmounting, or the scroller changing, does not call it.
	 */
	onEnd?: () => void;
}

/**
 * Watch a scroller's finger scrolls. `getScroller` returns a scrolling element,
 * or the document for the page's own scroll. Returns a reader, stable while the
 * component lives: `true` while the scroller's scroll is a finger's. Given a
 * time on the page's clock, it reads whether the scroll at that time was a
 * finger's.
 */
export function useFingerScroll(
	getScroller: () => Element | Document | null,
	options: UseFingerScrollOptions = {}
): (at?: number) => boolean {
	let watched: Element | Document | null = null;

	$effect(() => {
		const node = getScroller();
		if (node == null) {
			return;
		}
		watched = node;
		const stop = watchFingerScrolls(getGestureHost(documentOf(node)), node, () => {
			options.onEnd?.();
		});
		return () => {
			stop();
			if (watched === node) watched = null;
		};
	});

	return (at?: number) => {
		const node = watched;
		return node != null && isFingerScroll(getGestureHost(documentOf(node)), node, at);
	};
}
