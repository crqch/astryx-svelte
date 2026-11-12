import { createPager, type Pager, type UsePagerOptions } from '../pager.js';

/**
 * The Svelte face of upstream's `usePager`, ported from
 * `hooks/usePager.ts`.
 *
 * Upstream reads its options through a `useRef` updated by a layout effect, so
 * a callback a render creates costs nothing and a gesture never renders. Here
 * the options come in as a getter and each callback reads it at event time:
 * the same live read, without the ref.
 *
 * The pager is created once. `setOptions` syncs the live options after commit;
 * an effect attaches it to the viewport and track whenever either element is
 * replaced, and detaches at unmount. A controlled `index` moves the pager from
 * an effect, and a page the owner refuses returns it to the controlled value,
 * as a controlled input does.
 *
 * @example
 * ```svelte
 * const pager = usePager(() => ({
 *   viewportRef: () => viewportEl,
 *   trackRef: () => trackEl,
 *   count: items.length,
 *   index
 * }));
 * ```
 */
export function usePager(options: () => UsePagerOptions): Pager {
	const initial = options();
	// The two element getters, kept out of the options getter's own tracking:
	// the attach effect must re-run only when a node is replaced, not when any
	// prop changes (a detach would drop a settle's queued callbacks).
	const viewportOf = initial.viewportRef;
	const trackOf = initial.trackRef;
	// Bumped when the pager reports a page while `index` is controlled. The
	// effect below re-runs, so a render that kept the same `index` returns the
	// pager to it.
	let reported = $state(0);
	const pager = createPager({
		...initial,
		// A controlled initial page seeds the pager exactly as `defaultIndex`
		// does, as upstream's `defaultIndex: index ?? options.defaultIndex`.
		defaultIndex: initial.index ?? initial.defaultIndex,
		onIndexChange: (index, reason) => {
			const latest = options();
			latest.onIndexChange?.(index, reason);
			if (latest.index != null) {
				reported += 1;
			}
		},
		onSettle: (index, previous) => options().onSettle?.(index, previous),
		onPagesChange: (pageCount) => options().onPagesChange?.(pageCount),
		shouldBeginPan: (direction) => options().shouldBeginPan?.(direction) ?? true
	});

	// A clamp the pager causes is not reported back (reason 'controlled').
	// The options getter constructs the whole object, so this effect re-runs on
	// any prop change; the guard keeps it to upstream's `[count, gap, loop,
	// pages]` dependency list.
	let lastOptions = {
		count: initial.count,
		gap: initial.gap,
		loop: initial.loop,
		pages: initial.pages
	};
	$effect(() => {
		const latest = options();
		if (
			latest.count === lastOptions.count &&
			latest.gap === lastOptions.gap &&
			latest.loop === lastOptions.loop &&
			latest.pages === lastOptions.pages
		) {
			return;
		}
		lastOptions = {
			count: latest.count,
			gap: latest.gap,
			loop: latest.loop,
			pages: latest.pages
		};
		pager.setOptions({
			count: latest.count,
			gap: latest.gap,
			loop: latest.loop,
			pages: latest.pages
		});
	});

	// Attaches on the first frame both nodes exist, again whenever either node
	// is replaced, and detaches at unmount. `attach` carries a release's waiting
	// report across the replacement, as upstream's `useAttachmentPair` does.
	$effect(() => {
		const viewport = viewportOf();
		const track = trackOf();
		if (viewport == null || track == null) {
			return;
		}
		return pager.attach(viewport, track);
	});

	// Syncs the pan recognizer with `isPanEnabled`. What a drag it ends calls
	// back waits for the next frame, after this effect. Guarded so the options
	// getter's other reads cannot queue that frame on an unrelated change.
	let lastPanEnabled: boolean | undefined;
	$effect(() => {
		const enabled = options().isPanEnabled ?? true;
		if (enabled === lastPanEnabled) {
			return;
		}
		lastPanEnabled = enabled;
		pager.setPanEnabled(enabled);
	});

	// Syncs the pager, an imperative system outside Svelte, with a controlled
	// `index`. A new `index` moves the pager there, and so does the render after
	// a page it reported and the owner did not take. The move is the owner's
	// own, so it is not reported back. A refused page springs back whatever
	// `isControlledChangeAnimated` says.
	let syncedIndex = initial.index;
	$effect(() => {
		const latest = options();
		// Read so a report re-runs this effect even when `index` is unchanged.
		void reported;
		if (latest.index != null && latest.index !== pager.index) {
			pager.goTo(latest.index, {
				reason: 'controlled',
				animated: (latest.isControlledChangeAnimated ?? true) || latest.index === syncedIndex
			});
		}
		syncedIndex = latest.index;
	});

	return pager;
}
