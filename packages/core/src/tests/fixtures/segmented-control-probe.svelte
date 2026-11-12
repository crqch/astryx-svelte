<script lang="ts" module>
	export interface SegmentItemConfig {
		value: string;
		label: string;
		/** Icon-only: label becomes the `aria-label`. */
		isLabelHidden?: boolean;
		isDisabled?: boolean;
		/** Render an `icon` snippet exposing `data-testid="icon"`. */
		icon?: boolean;
		/** Rest prop forwarded onto the item button (the data-testid case). */
		'data-testid'?: string;
		/** Consumer `onclick` for the onClick-composition cases. */
		onclick?: (e: MouseEvent) => void;
		/** A caller description id, joined before the group's disabled reason. */
		describedBy?: string;
	}
</script>

<script lang="ts">
	import SegmentedControl, {
		type SegmentedControlProps
	} from '$lib/components/segmented-control/segmented-control.svelte';
	import SegmentedControlItem from '$lib/components/segmented-control/segmented-control-item.svelte';

	/**
	 * A `SegmentedControl` around `SegmentedControlItem` children, which upstream
	 * writes inline as JSX. A Svelte test cannot author a snippet, so the items are
	 * described by the `items` array and every group prop is forwarded through
	 * `...rest` (including `value`, `onChange`, `label`, `role`, `data-testid`,
	 * `onkeydown`).
	 *
	 * Selection is controlled exactly as upstream's: `value` is a plain prop and the
	 * test's `onChange` is a spy that does not commit — so clicking a segment fires
	 * `onChange` while `value` stays put, matching React's controlled group. Case 5
	 * ("updates aria-checked when value changes") drives the change with `rerender`,
	 * upstream's `rerender`.
	 *
	 * `before`/`after` add the sibling `<button>`s upstream writes around the group
	 * for the focus-entry and Tab-order cases. `icon` renders the
	 * `<span data-testid="icon">` that upstream passes as the `icon` element.
	 */
	interface Props extends Omit<SegmentedControlProps, 'children'> {
		items: SegmentItemConfig[];
		before?: boolean;
		after?: boolean;
	}

	let { items, before = false, after = false, ...rest }: Props = $props();
</script>

{#snippet iconSnippet()}
	<span data-testid="icon">G</span>
{/snippet}

{#if before}<button type="button">before</button>{/if}
<SegmentedControl {...rest}>
	{#each items as item, i (i)}
		<SegmentedControlItem
			value={item.value}
			label={item.label}
			isLabelHidden={item.isLabelHidden}
			isDisabled={item.isDisabled}
			icon={item.icon ? iconSnippet : undefined}
			data-testid={item['data-testid']}
			aria-describedby={item.describedBy}
			onclick={item.onclick}
		/>
	{/each}
</SegmentedControl>
{#if after}<button type="button">after</button>{/if}
