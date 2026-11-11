<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';
	import type { IconSize } from '../icon/icon.stylex.js';

	export type InfoTipSize = IconSize;

	export interface InfoTipProps extends Pick<BaseProps, 'xstyle' | 'class' | 'style'> {
		/**
		 * The help the button reveals. Short, noninteractive text; for links or
		 * buttons, use HoverCard.
		 */
		content: Snippet;
		/**
		 * Accessible name of the button.
		 *
		 * @default A translated "More information"
		 */
		label?: string;
		/**
		 * Size of the info icon. Maps 1:1 to Icon sizes
		 * (xsm: 12px, sm: 16px, md: 20px, lg: 24px).
		 *
		 * @default 'sm'
		 */
		size?: InfoTipSize;
		/** Ref forwarded to the info button. */
		ref?: HTMLButtonElement | null;
	}
</script>

<script lang="ts">
	import { cx, mergeStyle } from '../../internal/sx.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import Icon from '../icon/icon.svelte';
	import TooltipLayer from '../tooltip/tooltip-layer.svelte';
	import { useTooltip } from '../tooltip/use-tooltip.svelte.js';
	import { infoTipTriggerAttrs } from './info-tip.stylex.js';

	/**
	 * An info icon that reveals help: a small "i" button. Hover and keyboard
	 * focus preview the help. A click, tap, Enter, or Space pins it open until
	 * Escape, a second press, a press outside, or focus leaving. Use it next to
	 * labels, values, and metrics for permission notes, metric definitions, and
	 * field help.
	 *
	 * Ported from Astryx's `InfoTip/InfoTip.tsx`.
	 *
	 * The pin is this component's own state; the tooltip hook owns the layer,
	 * the shared dismissal stack, and the close-on-hide callback. Upstream's
	 * `useMergedRefs` has no counterpart: the button is bound once and the
	 * tooltip attachment is applied in markup, so there is no callback-ref
	 * identity to merge.
	 */
	let {
		content,
		label,
		size = 'sm',
		ref = $bindable(null),
		xstyle,
		class: className,
		style: styleProp
	}: InfoTipProps = $props();

	const t = useTranslator();
	const tooltipId = $props.id();

	// Whether a press pinned the help. A hover or focus preview is not pinned.
	let isPinned = $state(false);
	// Whether the help shows, pinned or previewed: the button names it in
	// `aria-controls` only then.
	let isShown = $state(false);
	// Whether the press that is about to become a click started on a pinned
	// trigger. The tooltip's own press-to-dismiss hides on `pointerdown` and
	// calls `onHide` before `click`; without recording the pin first, the click
	// would read the reset state and re-open what the press just closed.
	let wasPinnedAtPointerDown = false;

	const accessibleLabel = $derived(label ?? t('@astryx.infoTip.label'));

	const tooltip = useTooltip(() => ({
		id: tooltipId,
		// While pinned, the layer is controlled open. That suppresses the
		// tooltip's hover/focus hide scheduling, which is what makes a pinned
		// help survive the pointer leaving the trigger.
		isOpen: isPinned ? true : undefined,
		onShow: () => {
			isShown = true;
		},
		onHide: () => {
			isShown = false;
			isPinned = false;
		}
	}));

	const trigger = $derived(infoTipTriggerAttrs(xstyle));

	// A primary mouse or pen press on a preview calls show() first. The hook's
	// press-to-close then leaves it open. The click pins it.
	function handlePointerDown(event: PointerEvent): void {
		wasPinnedAtPointerDown = isPinned;
		if (event.button !== 0 || event.pointerType === 'touch' || isPinned || !isShown) {
			return;
		}
		tooltip.layer.show();
	}

	// A click, tap, Enter, or Space pins the help, and the next one closes it.
	// The press stops at the button: a clickable row, card, or label around it
	// does nothing, and document listeners still see it.
	function handleClick(event: MouseEvent): void {
		event.stopPropagation();
		event.preventDefault();
		if (isPinned || wasPinnedAtPointerDown) {
			tooltip.layer.hide();
			isPinned = false;
			wasPinnedAtPointerDown = false;
			return;
		}
		tooltip.layer.show();
		isPinned = true;
		wasPinnedAtPointerDown = false;
	}
</script>

<button
	bind:this={ref}
	type="button"
	aria-label={accessibleLabel}
	aria-describedby={tooltip.describedBy}
	aria-expanded={isPinned}
	aria-controls={isShown ? tooltip.describedBy : undefined}
	onpointerdown={handlePointerDown}
	onclick={handleClick}
	class={cx(trigger.class, className)}
	style={mergeStyle(trigger.style, styleProp as string | undefined)}
	{@attach tooltip.attachTrigger}
>
	<Icon icon="info" {size} />
</button>

<TooltipLayer {tooltip}>
	{@render content()}
</TooltipLayer>
