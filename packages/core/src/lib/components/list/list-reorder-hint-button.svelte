<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface ListReorderHintButtonProps {
		/** The button's accessible name, when its content is a glyph. */
		label?: string;
		onPress: () => void;
		/** A text button (Done) rather than a key glyph. */
		isText?: boolean;
		children: Snippet;
	}
</script>

<script lang="ts">
	import { useTouchHitArea } from '../../utils/touch-hit-area.svelte.js';
	import { hintButtonAttrs } from './list-reorder-handle.stylex.js';

	/**
	 * One of a reorder mode hint's buttons: it never takes the focus from the
	 * handle (a press does not move it), and does what its key does.
	 *
	 * Ported from Astryx's `HintButton` in `List/listReorderEngine.tsx`.
	 */
	let { label, onPress, isText = false, children }: ListReorderHintButtonProps = $props();

	let buttonEl = $state<HTMLButtonElement | null>(null);
	// A finger's target: the shared touch hit area grows the button's hit layer
	// where the primary pointer is coarse.
	useTouchHitArea(
		() => buttonEl,
		() => true
	);

	const attrs = $derived(hintButtonAttrs(isText));
</script>

<button
	bind:this={buttonEl}
	type="button"
	tabindex="-1"
	aria-label={label}
	onpointerdown={(event) => event.preventDefault()}
	onmousedown={(event) => event.preventDefault()}
	onclick={onPress}
	class={attrs.class}
	style={attrs.style}
>
	{@render children()}
</button>
