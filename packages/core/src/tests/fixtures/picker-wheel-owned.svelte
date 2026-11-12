<script lang="ts">
	import PickerWheel from '$lib/components/date-input/picker-wheel.svelte';
	import type { WheelOption } from '$lib/components/date-input/wheel-options.js';

	interface Props {
		options: ReadonlyArray<WheelOption>;
		initial: number;
		onChange: (value: number) => void;
	}

	/** Upstream's `OwnedWheel`: a wheel whose owner commits each change. */
	let { options, initial, onChange }: Props = $props();

	// The fixture's owner commits each change, so its own state starts once from
	// the initial value, as React's `useState` does.
	// svelte-ignore state_referenced_locally
	let value = $state(initial);
</script>

<PickerWheel
	label="Hour"
	{options}
	{value}
	onChange={(next) => {
		onChange(next);
		value = next;
	}}
/>
