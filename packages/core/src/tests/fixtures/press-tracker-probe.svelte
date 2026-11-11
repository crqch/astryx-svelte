<script lang="ts">
	import type {
		ControlEvent,
		PressHighlightDelay,
		PressTracker
	} from '$lib/gestures/press-tracker.js';
	import type { SelectionLock } from '$lib/gestures/gesture-recognizer.js';
	import { usePressTracker } from '$lib/gestures/use-press-tracker.svelte.js';

	let {
		onEvent,
		onHighlightChange,
		isDisabled = false,
		cancelTravel,
		selectionLock,
		isBraking,
		perEventPointer = false,
		highlightDelay,
		trackingExpansion,
		keepsTouch,
		which = 'button',
		show = true
	}: {
		onEvent?: (event: ControlEvent) => void;
		onHighlightChange?: (isHighlighted: boolean) => void;
		isDisabled?: boolean;
		cancelTravel?: number;
		selectionLock?: SelectionLock;
		isBraking?: () => boolean;
		perEventPointer?: boolean;
		highlightDelay?: PressHighlightDelay;
		trackingExpansion?: number;
		keepsTouch?: boolean;
		which?: 'button' | 'other';
		show?: boolean;
	} = $props();

	let element = $state<HTMLElement | null>(null);
	// A bind:this on a rerender re-runs the bound assignment; an attachment
	// runs only when the node is created or replaced, so the tracker's effect
	// does not detach and reattach for an unrelated prop change.
	const bindElement = (node: HTMLElement) => {
		element = node;
		return () => {
			if (element === node) element = null;
		};
	};
	const tracker: PressTracker = usePressTracker(() => element, {
		get onControlEvent() {
			return onEvent;
		},
		get onHighlightChange() {
			return onHighlightChange;
		},
		get cancelTravel() {
			return cancelTravel;
		},
		get selectionLock() {
			return selectionLock;
		},
		get isBraking() {
			return isBraking;
		},
		get perEventPointer() {
			return perEventPointer;
		},
		get highlightDelay() {
			return highlightDelay;
		},
		get trackingExpansion() {
			return trackingExpansion;
		},
		get isEnabled() {
			return () => !isDisabled;
		},
		keepsTouch
	});

	export const getTracker = () => tracker;
	export const getElement = () => element;
</script>

{#if show && which === 'button'}
	<button {@attach bindElement} data-testid="button" type="button">Go</button>
{:else if show}
	<button {@attach bindElement} data-testid="other" type="button">Other</button>
{/if}
