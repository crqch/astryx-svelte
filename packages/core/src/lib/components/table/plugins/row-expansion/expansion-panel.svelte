<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface ExpansionPanelProps {
		/** Every rendered column, including the synthetic `__expansion` one. */
		columnCount: number;
		/** The consumer's `renderExpanded`, folded into the bound snippet arg. */
		renderExpanded: Snippet<[Record<string, unknown>]>;
		item: Record<string, unknown>;
		/** `panelVariant === 'muted'`. */
		isMuted: boolean;
	}
</script>

<script lang="ts">
	import { useTableContext } from '../../table-context.svelte.js';
	import { expansionExpandedCellAttrs, expansionExpandedRowAttrs } from './row-expansion.stylex.js';

	/**
	 * The detail panel's `<tr>` and full-width `<td>`, ported from the markup
	 * `useTableRowExpansion.tsx` builds in `transformBodyRow` and its private
	 * `ExpansionPanelCell`.
	 *
	 * A component rather than a bare snippet because the cell reads the table's
	 * density and divider mode off the context, to indent itself to match the
	 * first column and to carry the row divider its own row gave up.
	 */
	let { columnCount, renderExpanded, item, isMuted }: ExpansionPanelProps = $props();

	const tableContext = useTableContext();
	const context = $derived(tableContext?.() ?? null);
	const density = $derived(context?.density ?? 'balanced');
	const hasRowDividers = $derived(context?.dividers === 'rows' || context?.dividers === 'grid');

	const rowAttrs = expansionExpandedRowAttrs();
	const cellAttrs = $derived(expansionExpandedCellAttrs(isMuted, density, hasRowDividers));
</script>

<!--
	A panel is its row's continuation, not a row of its own. Striping counts
	`:nth-child(even of :not([data-expansion-panel]))`, so this attribute is what
	keeps an open panel from inverting the zebra of every row beneath it.
	Load-bearing, not diagnostic.
-->
<tr data-expansion-panel="" class={rowAttrs.class} style={rowAttrs.style}>
	<td colspan={columnCount} class={cellAttrs.class} style={cellAttrs.style}>
		{@render renderExpanded(item)}
	</td>
</tr>
