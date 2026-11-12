import { untrack } from 'svelte';

/**
 * Block-axis overflow of an open menu, ported from Astryx's
 * `DropdownMenu/useMenuOverflow.ts`.
 *
 * A menu that fits is not made a scroll container, so its touch-action can stay
 * `pinch-zoom`; one that overflows hands vertical scrolling back to the browser
 * with `pan-y pinch-zoom`. The measurement runs again on resize, mutation and
 * the window's own resize, so an open menu that grows starts scrolling.
 *
 * Upstream takes a ref object; here the element is a getter, the same
 * translation its other ref-taking hooks take. `content` is read only for an
 * owner that supplies `expectedOverflow`: upstream stores it so a stale guess
 * is corrected when *that content* is measured, and reads nothing about content
 * otherwise. Reading it unconditionally would re-measure on every render of a
 * caller whose array is a new reference, which is an effect loop.
 */
export interface UseMenuOverflowOptions {
	/** The menu element, or null before it mounts. */
	menu: () => HTMLElement | null;
	/** The rendered content, read for change detection when a guess is given. */
	content: () => unknown;
	/** Whether the menu is open. */
	isOpen: () => boolean;
	/**
	 * The answer the owner can give before any measure, for content that cannot
	 * fit. Until a measure of the same content says otherwise it is the result,
	 * so the first open already renders the right class.
	 */
	expectedOverflow?: () => boolean | undefined;
}

/** Whether the open menu overflows its block-size constraint. */
export function useMenuOverflow(options: UseMenuOverflowOptions): () => boolean {
	let measured = $state<{ content: unknown; hasOverflow: boolean } | null>(null);
	// Null until an owner that gives a guess supplies the content the measure
	// stands for, exactly as upstream's `contentRef` is.
	let measuredContent: unknown = null;

	function measure(): void {
		const menu = options.menu();
		if (menu == null) {
			return;
		}
		const hasOverflow = menu.scrollHeight > menu.clientHeight + 1;
		// Read the previous result untracked: React's functional `setState` keeps
		// the measuring effect out of the state it writes, and a tracked read here
		// would subscribe the effect to its own write — an update loop as soon as
		// the measured answer changes once.
		const current = untrack(() => measured);
		if (
			current != null &&
			current.hasOverflow === hasOverflow &&
			Object.is(current.content, measuredContent)
		) {
			return;
		}
		measured = { content: measuredContent, hasOverflow };
	}

	$effect(() => {
		if (!options.isOpen()) {
			return;
		}
		const menu = options.menu();
		if (menu == null) {
			return;
		}
		if (options.expectedOverflow !== undefined) {
			measuredContent = options.content();
		}
		measure();

		const resizeObserver =
			typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
		const mutationObserver =
			typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => measure());
		resizeObserver?.observe(menu);
		mutationObserver?.observe(menu, {
			childList: true,
			characterData: true,
			subtree: true
		});
		menu.addEventListener('load', measure, true);
		window.addEventListener('resize', measure);
		window.visualViewport?.addEventListener('resize', measure);
		return () => {
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			menu.removeEventListener('load', measure, true);
			window.removeEventListener('resize', measure);
			window.visualViewport?.removeEventListener('resize', measure);
		};
	});

	return () => {
		const expected = untrack(() => options.expectedOverflow?.());
		if (expected === undefined) {
			return measured?.hasOverflow ?? false;
		}
		return measured != null && Object.is(measured.content, measuredContent)
			? measured.hasOverflow
			: expected;
	};
}
