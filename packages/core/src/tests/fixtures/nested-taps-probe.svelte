<script lang="ts">
	import { TapGestureRecognizer } from '$lib/gestures/tap-gesture-recognizer.js';
	import { useGestureRecognizer } from '$lib/gestures/use-gesture-recognizer.svelte.js';

	let {
		innerKey = 'first',
		onSingle
	}: {
		innerKey?: string;
		onSingle?: (recognizer: TapGestureRecognizer) => void;
	} = $props();

	let outer = $state<HTMLDivElement | null>(null);
	let inner = $state<HTMLDivElement | null>(null);
	const double = useGestureRecognizer(
		() => inner,
		() => new TapGestureRecognizer({ numberOfTapsRequired: 2 })
	);
	const single = useGestureRecognizer(
		() => outer,
		() => new TapGestureRecognizer(),
		(recognizer) => onSingle?.(recognizer)
	);
	single.requireToFail(double);
</script>

<div bind:this={outer}>
	{#key innerKey}
		<div bind:this={inner} data-testid="inner"></div>
	{/key}
</div>
