<script lang="ts">
	import { PanGestureRecognizer } from '$lib/gestures/pan-gesture-recognizer.js';
	import { useGestureRecognizer } from '$lib/gestures/use-gesture-recognizer.svelte.js';

	let {
		direction = 'horizontal' as 'horizontal' | 'vertical' | 'any',
		isEnabled = true,
		actionGroup = false,
		manageStyle,
		tag = 'div' as 'div' | 'section' | 'none',
		show = true,
		onGesture,
		onRecognizer
	}: {
		direction?: 'horizontal' | 'vertical' | 'any';
		isEnabled?: boolean;
		actionGroup?: boolean;
		manageStyle?: boolean;
		tag?: 'div' | 'section' | 'none';
		show?: boolean;
		onGesture?: (recognizer: PanGestureRecognizer) => void;
		onRecognizer?: (recognizer: PanGestureRecognizer) => void;
	} = $props();

	let element = $state<HTMLElement | null>(null);
	const pan = useGestureRecognizer(
		() => element,
		() => new PanGestureRecognizer({ direction }),
		(recognizer) => onGesture?.(recognizer),
		{
			get isEnabled() {
				return isEnabled;
			},
			get actionGroup() {
				return actionGroup;
			},
			get manageStyle() {
				return manageStyle;
			}
		}
	);
	onRecognizer?.(pan);

	export const getRecognizer = () => pan;
</script>

{#if show && tag === 'section'}
	<section bind:this={element} data-testid="surface"></section>
{:else if show && tag === 'div'}
	<div bind:this={element} data-testid="surface"></div>
{/if}
