<script lang="ts">
	import TableHeaderCell from '$lib/components/table/table-header-cell.svelte';
	import Table from '$lib/components/table/table.svelte';

	/**
	 * A bare `<TableHeaderCell>` inside a hand-written
	 * `<table><thead><tr>`, or inside a real `<Table>`, as upstream's
	 * `TableHeaderCell` cases write it. `rest` carries the props under test,
	 * including the attachment key standing in for upstream's `ref`.
	 */
	interface Props {
		/** Render inside a real `<Table>` (which supplies its own `<thead>`). */
		inTable?: boolean;
		text?: string;
		rest?: Record<string, unknown>;
	}

	const { inTable = false, text = 'Name', rest = {} }: Props = $props();
</script>

{#if inTable}
	<Table>
		<thead>
			<tr>
				<TableHeaderCell {...rest}>{text}</TableHeaderCell>
			</tr>
		</thead>
	</Table>
{:else}
	<table>
		<thead>
			<tr>
				<TableHeaderCell {...rest}>{text}</TableHeaderCell>
			</tr>
		</thead>
	</table>
{/if}
