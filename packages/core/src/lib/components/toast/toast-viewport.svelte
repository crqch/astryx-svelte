<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { ToastPosition } from './types.js';

	export interface ToastViewportProps {
		/** @default 'bottomEnd' */
		position?: ToastPosition;
		/** @default 5 */
		maxVisible?: number;
		inset?: { top?: number; bottom?: number; start?: number; end?: number };
		/**
		 * Promote viewport to CSS top layer via popover="manual".
		 * Set to false when inside a dialog or other top-layer element.
		 * @default true
		 */
		isTopLayer?: boolean;
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import ToastRow from './toast-row.svelte';
	import { setToastContext, type ToastContextValue } from './toast-context.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { useAnnounce } from '../../hooks/use-announce.js';
	import { INTERACTIVE_SELECTORS } from '../../hooks/use-clickable-container.svelte.js';
	import {
		moveFocusLeftBehind,
		noteFocusWithin,
		type FocusWithin
	} from '../../utils/focus-return.js';
	import { mergeStyle } from '../../internal/sx.js';
	import type { ToastEntry, ToastDismissReason, ToastContent } from './types.js';
	import { toastRootOutletAttrs, toastViewportAttrs } from './toast-viewport.stylex.js';

	/**
	 * Container that renders and manages toast notifications. Place at the root
	 * of your app to enable `useToast()`. Toasts stack with enter/exit animations
	 * and auto-promote to the CSS top layer.
	 *
	 * @example
	 * ```svelte
	 * <ToastViewport position="bottomEnd" maxVisible={3}>
	 *   <App />
	 * </ToastViewport>
	 * ```
	 */
	const {
		position = 'bottomEnd',
		maxVisible = 5,
		inset,
		isTopLayer = true,
		children
	}: ToastViewportProps = $props();

	const t = useTranslator();

	/**
	 * Announce toasts through `useAnnounce`'s persistent singleton live regions.
	 * Each `<Toast>` also renders its own `role="status"`/`"alert"` region, but
	 * that region is *born with content* — mounted together with its text — which
	 * many screen readers do not announce (see `use-announce.ts`); the singleton
	 * regions are mounted empty and only mutated afterwards, so they are what
	 * actually guarantees the announcement. The per-toast markup is kept for
	 * browse-mode discoverability.
	 *
	 * The announcement happens in `addToast` — the imperative dispatch path
	 * invoked once per `showToast()` call from an event handler, never from
	 * render — so each toast is announced exactly once by construction,
	 * independent of the render lifecycle: viewport re-renders and unrelated list
	 * changes never re-announce. It is client-only (`addToast` never runs during
	 * SSR), so it is SSR-safe.
	 */
	const announce = useAnnounce();

	/**
	 * Upstream flattens the toast body's `ReactNode` tree to plain text with a
	 * recursive `getNodeText`, walking `children` through every element. Its
	 * counterpart here is one line, and the reason is a limit rather than a
	 * simplification: `ToastContent` is `string | Snippet` (see `types.ts`), and a
	 * `Snippet` is an opaque function — there is no children tree to walk and no
	 * way to obtain its text without *rendering* it, which would run consumer code
	 * a second time and move the announcement out of the dispatch path that makes
	 * it exactly-once.
	 *
	 * So a string body is announced through the singleton regions, and a snippet
	 * body falls back to the toast's own (born-with-content) region — i.e. exactly
	 * the behaviour this port had before, with no regression, but without the
	 * 0.3.0 gain. Recorded in port/debts.md, beside the `ToastContent` entry it
	 * descends from.
	 */
	function toastText(body: ToastContent): string {
		return typeof body === 'string' ? body : '';
	}

	/**
	 * `$state.raw`, not `$state`: every mutation below is a whole-array
	 * reassignment, and upstream treats an entry as an opaque value. Deep-proxying
	 * would additionally make a consumer mutating the `ToastOptions` object it
	 * passed to `showToast()` re-render our toast, which React does not do.
	 */
	let toasts = $state.raw<ToastEntry[]>([]);
	/**
	 * Ids whose exit has begun. Upstream keeps this twice — a ref for the
	 * synchronous `onHide` double-fire guard, and state to drive the exit
	 * animation — because a React state update is not readable until the next
	 * render. A `SvelteSet` mutation is readable immediately, so one set does
	 * both jobs and `toastsRef`/`exitingIdsRef` disappear with it.
	 *
	 * Upstream replaces the set (`new Set(prev).add(id)`) because React needs a
	 * fresh reference to re-render; Svelte tracks the mutation itself, so the
	 * copy has no counterpart here.
	 */
	const exitingIds = new SvelteSet<string>();

	let viewportEl = $state<HTMLDivElement | null>(null);

	// Upstream's refs, and plain `let` for the same reason they are refs: no
	// render reads them, and the focus-handoff effect must re-run on `toasts`
	// alone, exactly as its dependency list says.
	let prevFocus: HTMLElement | null = null;
	// The element focus last reached inside the viewport, so focus coming back
	// from it is not treated as an entry from outside.
	let lastFocusedWithin: EventTarget | null = null;
	let focusHandoffId: string | null = null;
	let pendingFocus: string | 'restore' | null = null;
	// The id of a toast whose overwrite updated a row that held focus. If the
	// update removed the focused control, the commit hands focus off.
	let overwriteFocus: { id: string; note: FocusWithin } | null = null;
	// Where focus was inside a toast whose dismissal hands focus off.
	let dismissFocusNote: FocusWithin | null = null;
	/**
	 * Toasts dispatched since they last rendered, by id: a dismiss() called before
	 * a toast first renders still finds it (and its onHide).
	 */
	const pendingEntries = new Map<string, ToastEntry>();
	/**
	 * Rendered entries a repeat has replaced in the current batch: still found by
	 * a dismissal in the same handler. A toast replaced before it rendered was
	 * never shown and reports no onHide.
	 */
	const replacedEntries = new Map<string, ToastEntry>();
	/** Ids a row has mounted for, so "replaced before it rendered" is answerable. */
	const renderedIds = new Set<string>();

	/**
	 * Collect a focusable control within a toast node, if any. Reuses the
	 * canonical `INTERACTIVE_SELECTORS` list (native controls plus role-based
	 * interactive elements) instead of a hand-rolled subset, then narrows to the
	 * first candidate that can actually receive focus — excluding elements opted
	 * out with `tabindex="-1"` and disabled controls.
	 */
	function getFocusable(container: HTMLElement | null): HTMLElement | null {
		if (!container) {
			return null;
		}
		const candidates = container.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTORS);
		for (const candidate of candidates) {
			if (
				candidate.getAttribute('tabindex') === '-1' ||
				candidate.hasAttribute('disabled') ||
				candidate.getAttribute('aria-disabled') === 'true'
			) {
				continue;
			}
			return candidate;
		}
		return null;
	}

	/**
	 * Every mutator below reads the current list through `untrack`.
	 *
	 * Upstream never reads `toasts` while producing the next value — `addToast`
	 * is `useCallback(entry => setToasts(prev => …), [])`, and the current list
	 * is reachable only through `toastsRef`, which is inert. That is what makes
	 * the documented consumer pattern legal:
	 *
	 * ```
	 * useEffect(() => { if (error) toast({body: error, type: 'error'}); }, [error]);
	 * ```
	 *
	 * These functions are invoked through the context from the *caller's* stack
	 * frame, so a plain read would subscribe the caller's `$effect` to `toasts`;
	 * the write then dirties it, it re-runs, and Svelte aborts the tree with
	 * `effect_update_depth_exceeded`. `untrack` here — inside the viewport, where
	 * upstream put the functional updater — restores the ref semantics without
	 * asking every call site to opt out.
	 */
	function addToast(entry: ToastEntry): void {
		const { uniqueID, collisionBehavior = 'overwrite' } = entry.options;
		const list = untrack(() => toasts);
		const overwritten = uniqueID
			? list.find((item) => item.options.uniqueID === uniqueID)
			: undefined;
		// Resolve an ignored collision first, so a suppressed toast is neither
		// shown nor announced. A leaving toast still holds its uniqueID.
		if (overwritten && collisionBehavior === 'ignore') {
			return;
		}
		const text = toastText(entry.options.body);
		if (text) {
			// Error toasts map to the assertive region (role="alert"); everything
			// else to the polite region (role="status") — mirrors `toast.svelte`.
			announce(text, entry.options.type === 'error' ? 'assertive' : 'polite');
		}
		if (overwritten && renderedIds.has(overwritten.id)) {
			replacedEntries.set(overwritten.id, overwritten);
		}
		// An overwrite of a toast that is not leaving keeps its row, so the card
		// updates in place and focus inside it stays. A leaving namesake is
		// replaced by a new row, which enters again.
		const keepsRow = overwritten != null && !untrack(() => exitingIds.has(overwritten.id));
		const placed: ToastEntry = keepsRow
			? { ...entry, rowKey: overwritten.rowKey ?? overwritten.id }
			: entry;
		if (keepsRow) {
			// If the update removes the focused control, the commit hands focus off
			// as a dismissal does.
			const note = noteFocusWithin(
				untrack(() => viewportEl)?.querySelector<HTMLElement>(
					`[data-toast-id="${overwritten.id}"]`
				) ?? null
			);
			if (note != null) {
				overwriteFocus = { id: placed.id, note };
			}
		}
		const projected = overwritten
			? list.map((item) => (item === overwritten ? placed : item))
			: [...list, placed];
		// `maxVisible={0}` shows every toast (FR7): nothing leaves the window.
		const firstVisible = maxVisible > 0 ? projected.length - maxVisible : 0;
		const cutIds = new Set(
			projected
				.filter((item, index) => index < firstVisible && untrack(() => exitingIds.has(item.id)))
				.map((item) => item.id)
		);
		for (const id of cutIds) {
			// A leaving toast that a new one pushes out of the visible window can no
			// longer finish its exit on screen. It leaves now; waiting for its row
			// would surface it later as a collapsed empty slot holding the landmark.
			exitingIds.delete(id);
			pendingEntries.delete(id);
		}
		if (uniqueID) {
			// An overwrite replaces a toast that has not rendered yet too.
			for (const [pendingId, pendingEntry] of pendingEntries) {
				if (pendingEntry.options.uniqueID === uniqueID) {
					pendingEntries.delete(pendingId);
				}
			}
		}
		pendingEntries.set(entry.id, placed);
		toasts = projected.filter((item) => !cutIds.has(item.id));
	}

	function removeToast(id: string, reason: ToastDismissReason): void {
		// An exiting toast stays in `toasts` until its exit transition ends, so a
		// second dismissal inside that window (double-click, or the auto-timer
		// plus a manual dismiss) would re-fire `onHide`. Claiming the id first is
		// what makes the second call a no-op.
		if (untrack(() => exitingIds.has(id))) {
			return;
		}
		const list = untrack(() => toasts);
		const entry =
			list.find((item) => item.id === id) ?? replacedEntries.get(id) ?? pendingEntries.get(id);
		if (entry == null) {
			// Already gone: nothing to hide or report.
			return;
		}
		exitingIds.add(id);
		entry.options.onHide?.(reason);

		// If focus currently lives inside the toast being dismissed, remember that
		// its removal must hand focus off to a neighbour (or the element focused
		// before the user entered the viewport) rather than <body>.
		const el = untrack(() => viewportEl);
		const active = document.activeElement;
		// A toast an overwrite replaced in place no longer owns its row: the
		// replacement does, so dismissing the replaced toast leaves the row, and
		// focus in it, to the replacement.
		const rowKey = entry.rowKey ?? entry.id;
		const isReplacedInPlace =
			!list.some((item) => item.id === id) &&
			list.some((item) => (item.rowKey ?? item.id) === rowKey);
		const dismissedNode = isReplacedInPlace
			? null
			: (el?.querySelector<HTMLElement>(`[data-toast-id="${id}"]`) ?? null);
		if (dismissedNode && active instanceof Node && dismissedNode.contains(active)) {
			focusHandoffId = id;
			dismissFocusNote = noteFocusWithin(dismissedNode);
			// Pick the toast to receive focus while the DOM is still intact: the
			// nearest one after it, then before it, that shows once it is gone
			// (FR10), else restore. The list may already run ahead of the render
			// within this handler: a toast a repeat replaced has left it, and the
			// replacement holds its place, so the neighbours are taken around the
			// replacement, which takes focus only when no neighbour shows.
			const { uniqueID } = entry.options;
			const ownIndex = list.findIndex((item) => item.id === id);
			const placeIndex =
				ownIndex >= 0 || uniqueID == null
					? ownIndex
					: list.findIndex((item) => item.options.uniqueID === uniqueID);
			const remaining = list.filter((item) => item.id !== id);
			const shown = new Set(maxVisible > 0 ? remaining.slice(-maxVisible) : remaining);
			const isShown = (item: ToastEntry): boolean => shown.has(item);
			const replacement = ownIndex < 0 ? list[placeIndex] : undefined;
			const next =
				placeIndex < 0
					? undefined
					: (list.slice(placeIndex + 1).find(isShown) ??
						list.slice(0, placeIndex).reverse().find(isShown) ??
						(replacement != null && isShown(replacement) ? replacement : undefined));
			pendingFocus = next ? next.id : 'restore';
		}
		// A toast this handler has already pushed out of the visible window still
		// has its row now, but loses it when the batch renders.
		const index = list.findIndex((item) => item.id === id);
		const isPushedOut = maxVisible > 0 && index >= 0 && index < list.length - maxVisible;
		if (dismissedNode == null || isPushedOut) {
			// No row is mounted for it, or none will be: it is hidden past
			// `maxVisible`, or it has not rendered yet. Nothing animates out, so it
			// leaves the list now. Waiting for its row to finish exiting would keep
			// it forever: when it surfaced, its row would mount already collapsed,
			// with no transition left to end, and hold a visible slot as an empty
			// row.
			exitingIds.delete(id);
			pendingEntries.delete(id);
			replacedEntries.delete(id);
			toasts = list.filter((item) => item.id !== id);
		}
	}

	function handleExited(id: string): void {
		exitingIds.delete(id);
		pendingEntries.delete(id);
		toasts = untrack(() => toasts).filter((item) => item.id !== id);
	}

	function findByUniqueID(uid: string): ToastEntry | undefined {
		return untrack(() => toasts).find((item) => item.options.uniqueID === uid);
	}

	const contextValue: ToastContextValue = { addToast, removeToast, findByUniqueID };
	setToastContext(() => contextValue);

	/**
	 * Moves focus to a control in the target toast, else in another toast that
	 * shows (newest first), else back to the element focused before focus entered
	 * the viewport, so a handoff never drops focus to <body>.
	 */
	function handOffFocus(note: FocusWithin | null, targetId: string | null): void {
		const el = untrack(() => viewportEl);
		const list = untrack(() => toasts);
		const rowFor = (id: string): HTMLElement | null =>
			el?.querySelector<HTMLElement>(`[data-toast-id="${id}"]`) ?? null;
		const shownIds = list
			.slice(maxVisible > 0 ? -maxVisible : 0)
			.map((item) => item.id)
			.reverse();
		const candidates =
			targetId == null ? [] : [targetId, ...shownIds.filter((id) => id !== targetId)];
		let target: HTMLElement | null = null;
		for (const id of candidates) {
			target = getFocusable(rowFor(id));
			if (target != null) {
				break;
			}
		}
		const prev = prevFocus;
		const isReturning = target == null && prev != null && prev.isConnected;
		if (target == null) {
			target = isReturning ? prev : el;
		}
		if (moveFocusLeftBehind(note, target) && isReturning) {
			prevFocus = null;
		}
	}

	// After a dismissed toast unmounts, hand focus off so it never falls to
	// <body>. Runs once the toast list no longer contains the dismissed toast.
	$effect(() => {
		const list = toasts;
		const handoffId = focusHandoffId;
		const target = pendingFocus;
		if (handoffId == null || target == null) {
			return;
		}
		// Wait until the dismissed toast is actually gone from the list.
		if (list.some((item) => item.id === handoffId)) {
			return;
		}
		focusHandoffId = null;
		pendingFocus = null;
		const note = dismissFocusNote;
		dismissFocusNote = null;
		handOffFocus(note, target === 'restore' ? null : target);
	});

	// After an overwrite updated a row that held focus: focus stays on the same
	// control, or, if the update removed it, moves as a dismissal hands it off.
	$effect(() => {
		void toasts;
		const overwrite = overwriteFocus;
		if (overwrite == null) {
			return;
		}
		overwriteFocus = null;
		handOffFocus(overwrite.note, overwrite.id);
	});

	// Upstream clears the replaced-entry map on every render: it exists only for
	// a dismissal in the same handler that replaced the toast. The rendered-id
	// set is pruned the same way, so it describes the current list rather than
	// every id the viewport has ever shown.
	$effect(() => {
		const list = toasts;
		replacedEntries.clear();
		const current = new Set(list.map((item) => item.id));
		for (const id of renderedIds) {
			if (!current.has(id)) {
				renderedIds.delete(id);
			}
		}
	});

	/**
	 * Focus entering from outside, however it came, is where a dismissal of the
	 * last toast returns it. Focus moving between controls inside a toast is not
	 * an entry; `lastFocusedWithin` is what tells a return from a control that is
	 * still logically part of the toast apart from a fresh entry.
	 */
	function handleFocusIn(event: FocusEvent): void {
		const from = event.relatedTarget;
		const fromWithin =
			from === lastFocusedWithin ||
			(from instanceof Node && (event.currentTarget as Node).contains(from));
		lastFocusedWithin = event.target;
		if (from instanceof HTMLElement && !fromWithin) {
			prevFocus = from;
		}
	}

	// Show the popover on mount so it enters the top layer.
	$effect(() => {
		if (!isTopLayer) {
			return;
		}
		const el = viewportEl;
		if (el && typeof el.showPopover === 'function') {
			try {
				el.showPopover();
			} catch {
				/* already showing */
			}
		}
	});

	// F6 jumps focus into the toast viewport — the standard "go to notifications"
	// affordance. Focus the first control in the newest toast, or the viewport
	// container if none. Toasts are non-modal, so this only moves focus in;
	// Shift+Tab / Escape let focus leave naturally.
	const hasToasts = $derived(toasts.length > 0);
	$effect(() => {
		if (!hasToasts) {
			return;
		}
		const handleKeyDown = (e: KeyboardEvent): void => {
			if (e.key !== 'F6') {
				return;
			}
			const el = viewportEl;
			if (!el) {
				return;
			}
			// Already inside the viewport — nothing to do.
			const active = document.activeElement;
			if (active instanceof Node && el.contains(active)) {
				return;
			}
			e.preventDefault();
			// Remember where focus was so it can be restored on dismiss.
			if (active instanceof HTMLElement) {
				prevFocus = active;
			}
			// Newest toast is the last one rendered in the DOM.
			const toastNodes = el.querySelectorAll<HTMLElement>('[data-toast-id]');
			const newest = toastNodes[toastNodes.length - 1] ?? null;
			const focusable = getFocusable(newest) ?? newest ?? el;
			focusable.focus();
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	const visibleToasts = $derived(toasts.slice(-maxVisible));

	// Upstream builds this with truthiness checks, so an inset of `0` is ignored.
	// Replicated rather than fixed — see port/debts.md → Known debts.
	const insetStyle = $derived.by(() => {
		const parts: string[] = [];
		if (inset?.top) parts.push(`top:${inset.top}px`);
		if (inset?.bottom) parts.push(`bottom:${inset.bottom}px`);
		if (inset?.start) parts.push(`inset-inline-start:${inset.start}px`);
		if (inset?.end) parts.push(`inset-inline-end:${inset.end}px`);
		return parts.length > 0 ? parts.join(';') : undefined;
	});

	const viewport = $derived(toastViewportAttrs(position, hasToasts));
	const rootOutlet = toastRootOutletAttrs();

	// A stack anchored to the top edge leaves upward, so its swipe-to-dismiss
	// direction is inverted. The row resolves the same flag for the wrapper's
	// stacking styles and its gesture direction.
	const isReversed = $derived(position === 'topEnd' || position === 'topStart');
</script>

{@render children?.()}

<div
	bind:this={viewportEl}
	role={hasToasts ? 'region' : undefined}
	aria-label={hasToasts ? t('@astryx.toast.viewport') : undefined}
	tabindex={hasToasts ? -1 : undefined}
	popover={isTopLayer ? 'manual' : undefined}
	onfocusin={handleFocusIn}
	class={viewport.class}
	style={mergeStyle(viewport.style, insetStyle)}
>
	{#each visibleToasts as entry (entry.rowKey ?? entry.id)}
		<ToastRow
			{entry}
			isExiting={exitingIds.has(entry.id)}
			{isReversed}
			{exitingIds}
			onExited={handleExited}
			onDismiss={removeToast}
			onRendered={(id) => renderedIds.add(id)}
		/>
	{/each}
</div>
<!-- The modal host's mount point; empty until that subsystem lands. -->
<div class={rootOutlet.class} style={rootOutlet.style}></div>
