import type { Attachment } from 'svelte/attachments';
import { observeResize, unobserveResize } from '../internal/shared-resize-observer.js';

/**
 * Scroll-edge overflow tracking, ported from Astryx's
 * `hooks/useScrollOverflow.ts`.
 *
 * Observes a horizontally scrollable container and reports whether content
 * overflows at the start, the end, or at all — what a Carousel needs for its
 * fade edges and its scroll-button disabled states.
 *
 * Upstream returns a **ref callback**, and this port has an exact counterpart:
 * an attachment has the same attach/replace/detach lifecycle, so the body of
 * `scrollRef` becomes the attachment and its teardown becomes the attachment's
 * return. That also absorbs upstream's separate unmount `useEffect`, which
 * exists only because a ref callback has nowhere to put final cleanup.
 *
 * One thing simply disappears: upstream's `setState(prev => …)` compares the
 * three flags and returns `prev` unchanged to avoid a re-render. Assigning an
 * unchanged value to `$state` is already a no-op, so the comparison has no work
 * left to do.
 */

export interface ScrollOverflowState {
	/** Content overflows the start (left in LTR, right in RTL) */
	readonly overflowStart: boolean;
	/** Content overflows the end (right in LTR, left in RTL) */
	readonly overflowEnd: boolean;
	/** Whether the container has any overflow at all */
	readonly hasOverflow: boolean;
}

/** Where a held row is shown: its offset toward the end, and its travel. */
export interface ShownRow {
	readonly offset: number;
	readonly travel: number;
}

export interface ScrollOverflow extends ScrollOverflowState {
	/** Attach to the scroll container with `{@attach overflow.attach}`. */
	readonly attach: Attachment<HTMLElement>;
	/**
	 * Follow a row snap paging holds. While held, the edges come from its shown
	 * offset and travel; null keeps the reported edges until the next frame,
	 * when the handed-back scroll offset is current.
	 */
	readonly followShown: (shown: ShownRow | null) => void;
}

/**
 * Tracks scroll overflow state for a horizontally scrollable container.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   const overflow = useScrollOverflow();
 * </script>
 *
 * <div {@attach overflow.attach} style="overflow-x: auto">…</div>
 * {#if overflow.overflowStart}<span class="fade-start"></span>{/if}
 * ```
 */
export function useScrollOverflow(): ScrollOverflow {
	let overflowStart = $state(false);
	let overflowEnd = $state(false);
	let hasOverflow = $state(false);
	/** The row a hold shows, or null when the scroll offset is the truth. */
	let shown: ShownRow | null = null;
	let element: HTMLElement | null = null;
	let releaseFrame = 0;

	function measure(target: HTMLElement): void {
		const tolerance = 1;
		const offset = shown?.offset ?? Math.abs(target.scrollLeft);
		const maxScroll = shown?.travel ?? target.scrollWidth - target.clientWidth;

		overflowStart = offset > tolerance;
		overflowEnd = offset < maxScroll - tolerance;
		hasOverflow = maxScroll > tolerance;
	}

	/**
	 * A live report updates the edges before it returns, so a button changes in
	 * the frame the held row leaves its edge. A hand-back waits one frame for
	 * the scroll offset to be current, as upstream does, so an edge does not
	 * flicker through the change.
	 */
	function followShown(next: ShownRow | null): void {
		if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(releaseFrame);
		if (next != null) {
			shown = next;
			if (element != null) measure(element);
			return;
		}
		if (shown == null || element == null) {
			shown = null;
			return;
		}
		if (typeof requestAnimationFrame !== 'function') {
			shown = null;
			measure(element);
			return;
		}
		releaseFrame = requestAnimationFrame(() => {
			shown = null;
			if (element != null) measure(element);
		});
	}

	const attach: Attachment<HTMLElement> = (node) => {
		element = node;
		shown = null;
		const onScroll = () => measure(node);

		node.addEventListener('scroll', onScroll, { passive: true });
		// observeResize fires once on registration, so this covers the initial
		// measurement as well as later resizes.
		observeResize(node, onScroll);
		measure(node);

		return () => {
			unobserveResize(node);
			node.removeEventListener('scroll', onScroll);
			if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(releaseFrame);
			shown = null;
			if (element === node) element = null;
		};
	};

	return {
		get overflowStart() {
			return overflowStart;
		},
		get overflowEnd() {
			return overflowEnd;
		},
		get hasOverflow() {
			return hasOverflow;
		},
		attach,
		followShown
	};
}
