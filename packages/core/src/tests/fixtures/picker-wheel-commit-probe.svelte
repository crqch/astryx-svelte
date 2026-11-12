<script lang="ts">
	import PickerWheel from '$lib/components/date-input/picker-wheel.svelte';
	import type { WheelOption } from '$lib/components/date-input/wheel-options.js';

	interface Props {
		options: ReadonlyArray<WheelOption>;
		value: number;
		onCommit: (activeDescendant: string | null) => void;
	}

	/**
	 * Records the listbox's `aria-activedescendant` after every commit. Svelte's
	 * `$effect` runs after the DOM has been patched, which is the half of React's
	 * `Profiler.onRender` the case is about.
	 */
	let { options, value, onCommit }: Props = $props();

	let root = $state<HTMLDivElement | null>(null);

	$effect(() => {
		void value;
		const column = root?.querySelector('[role="listbox"]');
		onCommit(column?.getAttribute('aria-activedescendant') ?? null);
	});
</script>

<div bind:this={root}>
	<PickerWheel label="Hour" {options} {value} onChange={() => {}} />
</div>
