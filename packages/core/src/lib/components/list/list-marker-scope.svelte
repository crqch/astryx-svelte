<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { ListMarker, ListTaskMarker } from './list-context.svelte.js';

	export interface ListMarkerScopeProps {
		/** The marker to draw in place of the one the List's `listStyle` names. */
		marker: ListMarker;
		/** A task item's state, drawn as a read-only checkbox in the marker's place. */
		task?: ListTaskMarker;
		/** Keep the counter column at the themed width and let it paint outward. */
		hasMarkerGutter?: boolean;
		/** Keep a numbered item's counter beside its own text, not in the shared columns. */
		isOutsideNumberColumns?: boolean;
		children: Snippet;
	}
</script>

<script lang="ts">
	import { setListContext, useList } from './list-context.svelte.js';

	/**
	 * Ported from Astryx's `ListMarkerScope` in `List/ListContext.tsx`.
	 *
	 * Draws `marker` on the List items inside it, in place of the marker their
	 * List's `listStyle` names, or `task`'s read-only checkbox in place of
	 * either; internal, for Markdown's nested lists and task items in mixed
	 * lists. With `hasMarkerGutter`, counters keep the ordinary marker column
	 * and may paint outside it toward inline-start. With
	 * `isOutsideNumberColumns`, a numbered item keeps its counter beside its own
	 * text instead of in the shared column. Outside a List, or in a List without
	 * markers, it changes nothing.
	 */
	let {
		marker,
		task,
		hasMarkerGutter = false,
		isOutsideNumberColumns = false,
		children
	}: ListMarkerScopeProps = $props();

	// The parent's getter rather than its value: the scope adds to whatever the
	// enclosing List (or scope) publishes, and a later `density`/`edge` change
	// still reaches the items. Outside a List there is nothing to override, so
	// no context is set — upstream returns its children unwrapped in that case.
	const list = useList();
	if (list != null) {
		setListContext(() => ({
			...list(),
			marker,
			task,
			hasMarkerGutter,
			isOutsideNumberColumns
		}));
	}
</script>

{@render children()}
