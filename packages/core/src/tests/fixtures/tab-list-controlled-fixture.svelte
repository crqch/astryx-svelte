<script lang="ts">
	import { untrack } from 'svelte';
	import Tab from '$lib/components/tab-list/tab.svelte';
	import TabList from '$lib/components/tab-list/tab-list.svelte';

	/**
	 * Upstream's inline `Controlled` component in the press-reveal case: the
	 * TabList owns the value it was given and updates it from `onChange`, so a
	 * press really moves the selection.
	 */
	interface Props {
		initialValue: string;
		tabs: Array<{ value: string; label: string }>;
		onChange?: (value: string) => void;
	}

	const { initialValue, tabs, onChange }: Props = $props();

	let value = $state<string>(untrack(() => initialValue));

	function handleChange(next: string): void {
		value = next;
		onChange?.(next);
	}
</script>

<TabList {value} onChange={handleChange}>
	{#each tabs as tab (tab.value)}
		<Tab value={tab.value} label={tab.label} />
	{/each}
</TabList>
