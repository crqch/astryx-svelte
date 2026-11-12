<script lang="ts" module>
	export interface LiveSegmentItem {
		value: string;
		label: string;
	}
</script>

<script lang="ts">
	import SegmentedControl from '$lib/components/segmented-control/segmented-control.svelte';
	import SegmentedControlItem from '$lib/components/segmented-control/segmented-control-item.svelte';

	let { items, initial = 'one' }: { items: LiveSegmentItem[]; initial?: string } = $props();
	let value = $state(initial);

	export const getValue = () => value;
</script>

<SegmentedControl label="View mode" {value} onChange={(next) => (value = next)}>
	{#each items as item, index (index)}
		<SegmentedControlItem value={item.value} label={item.label} />
	{/each}
</SegmentedControl>
