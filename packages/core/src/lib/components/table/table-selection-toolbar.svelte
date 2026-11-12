<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { ToolbarProps } from '../toolbar/toolbar.svelte';
	import type { TableSelectionState } from './plugins/selection/use-table-selection-state.svelte.js';

	/**
	 * Ported from Astryx's `Table/TableSelectionToolbar.tsx`.
	 *
	 * A selection-aware action surface that never enters the Table plugin. The
	 * caller owns the action content and its placement; this component owns the
	 * shared Toolbar presentation, the selected count, and the complete clear
	 * command.
	 *
	 * Two translations:
	 *
	 * - **`renderSelectionLabel` is a `Snippet<[number]>`.** Upstream's
	 *   `(selectedCount) => ReactNode` prop hands back a node; a Svelte snippet is
	 *   the same slot authored in the caller's template. Returning nothing still
	 *   renders the empty `<span>` upstream's fragment does.
	 * - **`label` and `clearLabel` are `$derived`,** because `useTranslator` reads
	 *   the provider's locale at call time. Upstream's `t()` call runs on every
	 *   render for the same reason.
	 */
	export interface TableSelectionToolbarProps extends Omit<ToolbarProps, 'endContent' | 'label'> {
		/** Shared state returned by `useTableSelectionState`. */
		selection: TableSelectionState;
		/** Accessible name for the toolbar. @default 'Bulk actions' */
		label?: string;
		/** Override the visible selected-count content. */
		renderSelectionLabel?: Snippet<[number]>;
		/** Visible label for the command that clears the complete selection. @default 'Unselect All' */
		clearLabel?: string;
	}
</script>

<script lang="ts">
	import Button from '../button/button.svelte';
	import Toolbar from '../toolbar/toolbar.svelte';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';

	const {
		selection,
		label: labelFromProps,
		renderSelectionLabel,
		clearLabel: clearLabelFromProps,
		size = 'sm',
		variant = 'muted',
		...toolbarProps
	}: TableSelectionToolbarProps = $props();

	const t = useTranslator();

	const label = $derived(labelFromProps ?? t('@astryx.table.selection.bulkActionsLabel'));
	const clearLabel = $derived(clearLabelFromProps ?? t('@astryx.table.selection.clearAll'));
	const selectionLabel = $derived(
		renderSelectionLabel == null
			? t('@astryx.table.selection.selectedCount', { count: selection.selectedCount })
			: null
	);
</script>

{#snippet endContent()}
	<span>
		{#if renderSelectionLabel}
			{@render renderSelectionLabel(selection.selectedCount)}
		{:else}
			{selectionLabel}
		{/if}
	</span>
	<Button label={clearLabel} variant="ghost" onclick={selection.clearSelection} />
{/snippet}

{#if selection.hasSelection}
	<Toolbar {...toolbarProps} {label} {size} {variant} {endContent} />
{/if}
