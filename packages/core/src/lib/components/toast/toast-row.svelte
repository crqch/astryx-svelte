<script lang="ts" module>
	import type { SvelteSet } from 'svelte/reactivity';
	import type { ToastEntry, ToastDismissReason } from './types.js';

	/**
	 * One row of the stack: the grid wrapper that opens and collapses, and the
	 * clip that releases once it is open so the card's elevation can paint.
	 *
	 * Upstream declares `ToastRow` inside `ToastViewport.tsx`; it is extracted
	 * here so the two flags that live for exactly one mounted row —
	 * `hasEntryStarted` and `isSettled` — are `$state` local to it, the same
	 * lifetime upstream gives them with `useState`. A row leaves the DOM by more
	 * paths than dismissal — `maxVisible` evicts the oldest when a newer toast
	 * arrives — and on those paths nothing on the dismissal path runs to prune
	 * a flag held on the viewport. Holding it on the row makes every one of them
	 * the same event: the row unmounts, the flag goes with it.
	 */
	export interface ToastRowProps {
		entry: ToastEntry;
		isExiting: boolean;
		/** Top-anchored stacks grow downward and flip the row's drift and gap. */
		isReversed: boolean;
		/**
		 * The viewport's closing-id set, read at event time. A source, not a
		 * derived: the row's own `transitionend` can remove this row, and a
		 * derived belonging to the destroyed block is inert afterwards.
		 */
		exitingIds: SvelteSet<string>;
		onExited: (id: string) => void;
		onDismiss: (id: string, reason: ToastDismissReason) => void;
		/** Tell the viewport this row has rendered, for its replaced-toast bookkeeping. */
		onRendered: (id: string) => void;
	}
</script>

<script lang="ts">
	import ToastSurface from './toast-surface.svelte';
	import { toastWrapperAttrs, toastWrapperInnerAttrs } from './toast-viewport.stylex.js';

	const {
		entry,
		isExiting,
		isReversed,
		exitingIds,
		onExited,
		onDismiss,
		onRendered
	}: ToastRowProps = $props();

	let rowEl = $state<HTMLDivElement | null>(null);
	let isSettled = $state(false);
	let hasEntryStarted = $state(false);

	// A toast is "rendered" once a row has mounted for it. The viewport records
	// this so an entry replaced before it ever mounted reports nothing when the
	// handle that replaced it also dismisses it.
	$effect(() => {
		onRendered(entry.id);
	});

	// React's transition run and cancel events have no propertyName field.
	$effect(() => {
		const row = rowEl;
		if (row == null) {
			return;
		}
		const onTransition = (event: TransitionEvent): void => {
			if (event.target !== row || event.propertyName !== 'grid-template-rows') {
				return;
			}
			hasEntryStarted = true;
			// A move cancels the entry, and the row then renders fully open. No
			// transition ends, so the row settles here.
			if (event.type === 'transitioncancel') {
				isSettled = true;
			}
		};
		row.addEventListener('transitionrun', onTransition);
		row.addEventListener('transitioncancel', onTransition);
		return () => {
			row.removeEventListener('transitionrun', onTransition);
			row.removeEventListener('transitioncancel', onTransition);
		};
	});

	const options = $derived(entry.options);
	const type = $derived(options.type ?? 'info');
	const isAutoHide = $derived(options.isAutoHide ?? (type === 'error' ? false : true));
	const wrapper = $derived(toastWrapperAttrs(isReversed, hasEntryStarted, isExiting));
	const wrapperInner = $derived(toastWrapperInnerAttrs(isSettled, isExiting));
</script>

<div
	bind:this={rowEl}
	data-toast-id={entry.id}
	class={wrapper.class}
	style={wrapper.style}
	ontransitionend={(e: TransitionEvent) => {
		// `grid-template-rows` is not private to this wrapper — any descendant may
		// animate its own grid, and transitionend bubbles. Only the row's own
		// transition says the row has finished opening or collapsing. React never
		// sees a descendant's: it delegates `transitionend` at the root container.
		if (e.target !== e.currentTarget) {
			return;
		}
		if (e.propertyName !== 'grid-template-rows') {
			return;
		}
		// `exitingIds.has()` is a plain source read — correct after this row's
		// block is gone, and non-tracking because a DOM handler runs outside any
		// reaction.
		if (exitingIds.has(entry.id)) {
			onExited(entry.id);
			return;
		}
		// The row is fully open now. Release only the paint clip; the wrapper
		// still owns pointer events and restores the clip synchronously when
		// dismissal starts.
		isSettled = true;
		hasEntryStarted = true;
	}}
>
	<div class={wrapperInner.class} style={wrapperInner.style}>
		<ToastSurface
			{type}
			body={options.body}
			endContent={options.endContent}
			{isAutoHide}
			autoHideDuration={options.autoHideDuration ?? 5000}
			{isExiting}
			gestureDirection={isReversed ? -1 : 1}
			onDismiss={(reason) => onDismiss(entry.id, reason)}
			renderContent={options.renderContent}
			{hasEntryStarted}
			isLiveRegion={false}
			timerKey={entry.id}
		/>
	</div>
</div>
