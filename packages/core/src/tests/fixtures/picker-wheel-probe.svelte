<script lang="ts">
	import PickerWheel from '$lib/components/date-input/picker-wheel.svelte';
	import type { WheelOption } from '$lib/components/date-input/wheel-options.js';

	interface Props {
		label?: string;
		options: ReadonlyArray<WheelOption>;
		value: number;
		onChange: (value: number) => void;
		isActive?: boolean;
	}

	/** A live PickerWheel whose instance API the test can call. */
	let { label = 'Hour', options, value, onChange, isActive = true }: Props = $props();

	let wheel = $state<PickerWheel | null>(null);

	export function spinTo(index: number): Promise<boolean> {
		return wheel?.spinTo(index) ?? Promise.resolve(false);
	}
</script>

<PickerWheel bind:this={wheel} {label} {options} {value} {onChange} {isActive} />
