<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BusyIndicatorLane } from './busy-indicator-lane.svelte.js';

	export interface TypeaheadEndLaneProps {
		/** The field's busy lane, driven by the `BaseTypeahead` inside it. */
		lane: BusyIndicatorLane;
		/** Accessible name for the search Spinner. */
		loadingLabel: string;
		/** The clear button, when the field has one to show. */
		clear?: Snippet;
	}
</script>

<script lang="ts">
	import Spinner from '../spinner/spinner.svelte';
	import { typeaheadEndLaneAttrs } from './typeahead.stylex.js';

	/**
	 * Ported from Astryx's `Typeahead/Typeahead.tsx` `EndLane`.
	 *
	 * The field's inline-end lane: the busy Spinner, then the clear button.
	 *
	 * A separate component so that subscribing to the busy state re-renders
	 * THIS and nothing else. Subscribing from `Typeahead` itself would re-render
	 * the whole field — and, in the Tokenizer that shares this design, every
	 * selected token — twice per search for one glyph. Svelte's fine-grained
	 * reactivity narrows that to the lane's own DOM, and the component boundary
	 * keeps the read itself in the leaf that paints it.
	 *
	 * Renders nothing when there is neither a spinner nor a clear button, which
	 * is what keeps an empty flex item from taking a gap in the row.
	 */
	const { lane, loadingLabel, clear }: TypeaheadEndLaneProps = $props();

	const isBusy = $derived(lane.getIsBusy());
	const endLaneAttrs = typeaheadEndLaneAttrs();
</script>

{#if isBusy || clear}
	<div class={endLaneAttrs.class} style={endLaneAttrs.style}>
		{#if isBusy}
			<!-- Named, never live: the typeahead announces its search. -->
			<Spinner size="sm" role="img" aria-label={loadingLabel} />
		{/if}
		{#if clear}{@render clear()}{/if}
	</div>
{/if}
