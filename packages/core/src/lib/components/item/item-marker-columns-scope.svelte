<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface ItemMarkerColumnsScopeProps {
		/** Whether the rows inside this scope join a List's shared number columns. */
		columns: () => boolean;
		children: Snippet;
	}
</script>

<script lang="ts">
	import { setItemMarkerColumns } from './item-marker-columns-context.svelte.js';

	/**
	 * Ported from the nested `ItemMarkerColumnsContext` provider in
	 * `Item/Item.tsx`.
	 *
	 * `Item` resets the request for everything it renders: a numbered List row
	 * wraps its `Item`, so without this reset an `Item` placed inside that row's
	 * start/end content would inherit the row's request and wrap its own content
	 * as a second column group. Svelte's snippet owner reaches the context just
	 * as React's tree does, so the reset is load-bearing here too.
	 */
	let { columns, children }: ItemMarkerColumnsScopeProps = $props();

	setItemMarkerColumns(() => columns());
</script>

{@render children()}
