<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BaseProps } from '../../base-props.js';

	export interface SegmentedControlItemProps extends BaseProps<HTMLButtonElement> {
		/** Unique value for this segment, matched against the parent's `value`. */
		value: string;
		/** Accessible label — visible text, or the `aria-label` when `isLabelHidden`. */
		label: string;
		/** Show only the icon; the label becomes the `aria-label`. @default false */
		isLabelHidden?: boolean;
		/** Icon rendered before the label. */
		icon?: Snippet;
		/** Disable this individual segment. @default false */
		isDisabled?: boolean;
	}
</script>

<script lang="ts">
	import { cx } from '../../internal/sx.js';
	import { themeProps } from '../../internal/theme-props.js';
	import { segmentTitleProps } from '../../private-attributes/segment-title.js';
	import { segmentDisabledProps } from '../../private-attributes/segment-disabled.js';
	import { usePressFeedback } from '../../hooks/use-press-feedback.svelte.js';
	import { useSegmentedControlContext } from './segmented-control-context.svelte.js';
	import {
		segmentedControlIconAttrs,
		segmentedControlItemAttrs,
		segmentedControlLabelTextAttrs
	} from './segmented-control-item.stylex.js';

	/**
	 * A single segment within a `SegmentedControl`, rendered as a `role="radio"`
	 * button. Reads the group's selection/size/disabled state from context.
	 */
	const {
		value,
		label,
		isLabelHidden = false,
		icon,
		isDisabled = false,
		'aria-describedby': ariaDescribedByProp,
		onclick: onClickProp,
		...rest
	}: SegmentedControlItemProps = $props();

	const group = useSegmentedControlContext();

	const isSelected = $derived(group().value === value);
	const isItemDisabled = $derived(isDisabled || group().isDisabled);
	const isTouchPresentation = $derived(group().isTouchPresentation);
	/** The group's reason describes each segment, after a caller's own ids. */
	const describedBy = $derived(
		[ariaDescribedByProp, group().disabledReasonID]
			.filter((id): id is string => typeof id === 'string' && id.length > 0)
			.join(' ') || undefined
	);
	/** A press can change an unselected, enabled segment: it paints the overlay. */
	const isPressable = $derived(!isSelected && !isItemDisabled);
	const pressable = usePressFeedback();
	const size = $derived(group().size);
	const isFill = $derived(group().layout === 'fill');

	const theme = $derived(
		themeProps('segmented-control-item', {
			size,
			selected: isSelected ? 'selected' : null,
			disabled: isItemDisabled ? 'disabled' : null
		})
	);
	const itemAttrs = $derived(
		segmentedControlItemAttrs({
			size,
			isSelected,
			isItemDisabled,
			isFill,
			isLabelHidden,
			isTouchPresentation
		})
	);
	const iconAttrs = $derived(segmentedControlIconAttrs(size));
	const labelTextAttrs = segmentedControlLabelTextAttrs();

	// Consumer-first: a consumer `onclick` can `preventDefault()` to opt out of
	// selection; otherwise selection proceeds when enabled and not already selected.
	function handleClick(e: MouseEvent & { currentTarget: HTMLButtonElement }): void {
		// A disabled segment runs no caller handler: a group disabled with a
		// reason stays focusable, so Enter and Space can synthesize a click.
		if (isItemDisabled) {
			return;
		}
		onClickProp?.(e);
		if (e.defaultPrevented) {
			return;
		}
		if (!isSelected) {
			group().onChange(value);
		}
	}
</script>

<button
	{...rest}
	type="button"
	role="radio"
	aria-checked={isSelected}
	aria-disabled={isItemDisabled || undefined}
	aria-label={isLabelHidden ? label : undefined}
	aria-describedby={describedBy}
	data-value={value}
	{...segmentDisabledProps(isDisabled)}
	{...isPressable ? pressable : undefined}
	tabindex={isSelected ? 0 : -1}
	onclick={handleClick}
	{...theme}
	class={cx(theme.class, itemAttrs.class)}
	style={itemAttrs.style}
>
	{#if icon}
		<span class={iconAttrs.class} style={iconAttrs.style}>{@render icon()}</span>
	{/if}
	{#if !isLabelHidden}<span
			{...segmentTitleProps}
			class={labelTextAttrs.class}
			style={labelTextAttrs.style}>{label}</span
		>{/if}
</button>
