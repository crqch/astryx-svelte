<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';

	export interface SliderValueTooltipProps {
		/** The formatted value to show. */
		content: string;
		/** Layer placement for the bubble. */
		placement: 'above' | 'start';
		/** Controlled open state during a drag. */
		isOpen: boolean | undefined;
		/** Which axis the anchor travels on. */
		isHorizontal: boolean;
		/** The thumb's place along the travel, from 0 to 1. */
		progress: number;
		/** This thumb's index, which keys its registered anchor. */
		index: number;
		/** Records this tooltip's position anchor with the Slider. */
		registerAnchor: (
			index: number,
			anchor: { element: HTMLElement; tooltipId: string } | null
		) => void;
		/**
		 * The thumb, rendered with the attachment that makes it the tooltip's
		 * interaction trigger and the id it should add to `aria-describedby`.
		 */
		thumbTrigger: Snippet<[Attachment<HTMLElement>, string]>;
	}
</script>

<script lang="ts">
	import { useTooltip } from '../tooltip/use-tooltip.svelte.js';
	import TooltipLayer from '../tooltip/tooltip-layer.svelte';
	import { sliderValueAnchorAttrs } from './slider.stylex.js';

	/**
	 * A thumb's value tooltip, ported from Astryx's `SliderValueTooltip`.
	 *
	 * Hover and focus stay on the thumb; the position comes from a thumb-sized
	 * anchor that layout places at the value (`sliderValueAnchorAttrs`), so
	 * moving the thumb does not move its layout box and the bubble can travel by
	 * `translate` with it. Upstream's `positionRef` is `attachPosition` here and
	 * its `interactionRef` is `attachInteraction`, split the same way `<Tooltip>`
	 * splits them.
	 */
	const {
		content,
		placement,
		isOpen,
		isHorizontal,
		progress,
		index,
		registerAnchor,
		thumbTrigger
	}: SliderValueTooltipProps = $props();

	const id = $props.id();

	const tooltip = useTooltip(() => ({
		id,
		placement,
		delay: 0,
		focusTrigger: 'always',
		isOpen
	}));

	const anchorAttrs = $derived(sliderValueAnchorAttrs(isHorizontal));

	/**
	 * Upstream's `recordAnchor` ref callback. An attachment re-runs when the
	 * tooltip's described-by id changes (a locale or layer change), which is
	 * the same moment React would mount a new anchor.
	 */
	function anchorRegistration(node: HTMLElement): () => void {
		registerAnchor(index, { element: node, tooltipId: tooltip.describedBy });
		return () => registerAnchor(index, null);
	}
</script>

<span
	aria-hidden="true"
	{@attach tooltip.attachPosition}
	{@attach anchorRegistration}
	class={anchorAttrs.class}
	style={anchorAttrs.style}
	style:--_slider-progress={progress}
></span>
{@render thumbTrigger(tooltip.attachInteraction, tooltip.describedBy)}
<TooltipLayer {tooltip}>{content}</TooltipLayer>
