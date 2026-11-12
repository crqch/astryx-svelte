<script lang="ts">
	import { TapGestureRecognizer } from '$lib/gestures/tap-gesture-recognizer.js';
	import { useGestureRecognizer } from '$lib/gestures/use-gesture-recognizer.svelte.js';

	let {
		doubleEnabled = true,
		requireAtCreation = false,
		onSingle
	}: {
		doubleEnabled?: boolean;
		requireAtCreation?: boolean;
		onSingle?: (recognizer: TapGestureRecognizer) => void;
	} = $props();

	let element = $state<HTMLDivElement | null>(null);
	const double = useGestureRecognizer(
		() => element,
		() => new TapGestureRecognizer({ numberOfTapsRequired: 2 }),
		undefined,
		{
			get isEnabled() {
				return doubleEnabled;
			}
		}
	);
	const single = useGestureRecognizer(
		() => element,
		() =>
			requireAtCreation
				? new TapGestureRecognizer().requireToFail(double)
				: new TapGestureRecognizer(),
		(recognizer) => onSingle?.(recognizer)
	);
	if (!requireAtCreation) single.requireToFail(double);

	export const getRecognizers = () => ({ double, single });
</script>

<div bind:this={element} data-testid="surface"></div>
