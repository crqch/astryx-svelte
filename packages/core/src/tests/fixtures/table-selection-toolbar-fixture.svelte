<script lang="ts" module>
	import type { TableSelectionState } from '$lib/components/table/plugins/selection/use-table-selection-state.svelte.js';

	/**
	 * Upstream's five `TableSelectionToolbar.test.tsx` renders, reduced to flags.
	 * The state object comes from the test (it is a plain value there too), and
	 * the two `renderSelectionLabel` shapes are snippets, which a test file
	 * cannot author.
	 */
	export interface TableSelectionToolbarFixtureProps {
		selection: TableSelectionState;
		label?: string;
		clearLabel?: string;
		/** `renderSelectionLabel={() => null}`. */
		hideSelectionLabel?: boolean;
		/** `renderSelectionLabel={count => `${count} invoices selected`}`. */
		isInvoiceLabel?: boolean;
		/** Upstream's `startContent={<Button label="Export" variant="ghost" />}`. */
		hasStartContent?: boolean;
	}
</script>

<script lang="ts">
	import Button from '$lib/components/button/button.svelte';
	import TableSelectionToolbar from '$lib/components/table/table-selection-toolbar.svelte';

	const {
		selection,
		label,
		clearLabel,
		hideSelectionLabel = false,
		isInvoiceLabel = false,
		hasStartContent = false
	}: TableSelectionToolbarFixtureProps = $props();
</script>

{#snippet emptyLabel()}{/snippet}

{#snippet invoiceLabel(count: number)}
	{count} invoices selected
{/snippet}

{#snippet startContent()}
	<Button label="Export" variant="ghost" />
{/snippet}

<TableSelectionToolbar
	{selection}
	{label}
	{clearLabel}
	renderSelectionLabel={hideSelectionLabel ? emptyLabel : isInvoiceLabel ? invoiceLabel : undefined}
	startContent={hasStartContent ? startContent : undefined}
/>
