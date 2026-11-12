<script lang="ts" module>
	import type { InputStatusType } from '../field/types.js';
	import type { ThemeProps } from '../../internal/theme-props.js';
	import type { ISOTimeString } from '../../utils/time-parser.js';

	export type NativeTimeSegmentHourFormat = '12h' | '24h';

	export interface NativeTimeSegmentProps {
		id: string;
		value?: ISOTimeString;
		onChange: (value: ISOTimeString | undefined) => void;
		placeholder: string;
		inputLabel?: string;
		openPickerLabel: string;
		ariaLabelledBy?: string;
		iconThemeProps?: ThemeProps;
		hasAutoFocus?: boolean;
		min?: ISOTimeString;
		max?: ISOTimeString;
		hourFormat: NativeTimeSegmentHourFormat;
		isEffectivelyDisabled: boolean;
		/** While disabled, stay focusable: aria-disabled and readOnly, not `disabled`. */
		isFocusableDisabled: boolean;
		isEffectivelyRequired: boolean;
		isBusy: boolean;
		statusType?: InputStatusType;
		ariaDescribedBy?: string;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { hasEditableDateSegments } from '../date-input/native-date-segments.js';
	import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
	import { useLocale } from '../../i18n/use-locale.svelte.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { formatLocaleTime } from '../../utils/time-format.js';
	import { formatISOTime, isTimeInRange, parseISOTime } from '../../utils/time-parser.js';
	import Icon from '../icon/icon.svelte';
	import VisuallyHidden from '../visually-hidden/visually-hidden.svelte';
	import {
		nativePickerSegmentIconButtonAttrs,
		nativePickerSegmentInputAttrs,
		nativePickerSegmentOverlayAttrs,
		nativePickerSegmentSlotAttrs
	} from './native-picker-segment.stylex.js';

	const FRACTIONAL_SECONDS = /\.\d+$/;

	function normalizeNativeTime(value: string | undefined): ISOTimeString | undefined {
		if (!value) {
			return undefined;
		}
		const withoutFraction = value.replace(FRACTIONAL_SECONDS, '') as ISOTimeString;
		const parsed = parseISOTime(withoutFraction);
		return parsed ? formatISOTime(parsed, false) : undefined;
	}

	/**
	 * The shared native time control, ported from Astryx's
	 * `DateTimeInput/NativeTimeSegment.tsx`.
	 *
	 * Hands time picking to the platform through `<input type="time">`. The input
	 * is deliberately uncontrolled and observed through native event listeners,
	 * matching `native-date-segment.svelte`'s iOS-safe value ownership: external
	 * values only reconcile while the picker is unfocused, and native edits do
	 * not depend on a synthetic change event.
	 *
	 * Internal to `DateTimeInput`; not exported from the barrel, exactly as
	 * upstream keeps it out of `DateTimeInput/index.ts`.
	 */
	let {
		id,
		value,
		onChange,
		placeholder,
		inputLabel,
		openPickerLabel,
		ariaLabelledBy,
		iconThemeProps,
		hasAutoFocus = false,
		min,
		max,
		hourFormat,
		isEffectivelyDisabled,
		isFocusableDisabled,
		isEffectivelyRequired,
		isBusy,
		statusType,
		ariaDescribedBy
	}: NativeTimeSegmentProps = $props();

	const t = useTranslator();
	const locale = useLocale();
	const isTouchPointer = useMediaQuery(() => '(pointer: coarse)');

	let input = $state<HTMLInputElement | null>(null);

	let rejectedValue = $state<string | null>(null);
	let isFocused = $state(false);
	let isSegmentEditable = $state(false);
	let valueAtFocus: string | null = null;
	let lastCommit: string | null = null;

	// svelte-ignore state_referenced_locally
	let prevValue: ISOTimeString | undefined = value;
	$effect.pre(() => {
		const next = value;
		untrack(() => {
			if (next !== prevValue) {
				prevValue = next;
				// Preserve the accepted DOM value while the OS wheel is open so an
				// optimistic rollback cannot replay that edit when the field blurs.
				if (!isFocused) {
					lastCommit = null;
				}
				if (rejectedValue !== null) {
					rejectedValue = null;
				}
			}
		});
	});

	const nativeValue = $derived(normalizeNativeTime(value) ?? '');
	const isInputValid = $derived(rejectedValue === null);
	const overlayText = $derived(
		nativeValue ? formatLocaleTime(nativeValue, locale(), hourFormat, false) : placeholder
	);
	const showsOverlay = $derived(!!overlayText && !(isFocused && isSegmentEditable));

	function commitValue(newValue: string): void {
		if (isEffectivelyDisabled || lastCommit === newValue) {
			return;
		}

		if (!newValue) {
			lastCommit = newValue;
			rejectedValue = null;
			if (value !== undefined) {
				onChange(undefined);
			}
			return;
		}

		const normalized = normalizeNativeTime(newValue);
		if (!normalized) {
			return;
		}
		if (!isTimeInRange(normalized, min, max)) {
			rejectedValue = newValue;
			return;
		}

		rejectedValue = null;
		lastCommit = newValue;
		if (normalized !== value) {
			onChange(normalized);
		}
	}

	function handleNative(event: Event): void {
		commitValue((event.target as HTMLInputElement).value);
	}

	// React touches defaultValue after mount when the prop changes; Svelte's
	// binding below touches it once and this effect owns every later write. Keep
	// the mount value constant so an external change cannot reach a focused
	// control and detach the OS picker.
	// svelte-ignore state_referenced_locally
	const initialValue = normalizeNativeTime(value) ?? '';

	$effect(() => {
		if (isFocused) {
			return;
		}
		const el = input;
		const next = nativeValue;
		if (el && el.value !== next) {
			el.value = next;
		}
	});

	function handleFocus(): void {
		valueAtFocus = nativeValue;
		// The engine probe classifies whether WebKit/Blink exposes editable native
		// segments. Date and time controls share that engine-level behavior.
		isSegmentEditable = hasEditableDateSegments(isTouchPointer.matches);
		isFocused = true;
	}

	function handleBlur(): void {
		const domValue = input?.value;
		const valueChangedWhileFocused = valueAtFocus !== null && valueAtFocus !== nativeValue;
		const wasRejected = rejectedValue !== null;
		valueAtFocus = null;
		isFocused = false;
		rejectedValue = null;
		if (
			!valueChangedWhileFocused &&
			!wasRejected &&
			domValue !== undefined &&
			domValue !== nativeValue
		) {
			commitValue(domValue);
		}
		lastCommit = null;
	}

	function openPicker(): void {
		if (isEffectivelyDisabled) {
			return;
		}
		const el = input;
		if (!el) {
			return;
		}
		el.focus();
		if (typeof el.showPicker === 'function') {
			try {
				el.showPicker();
			} catch {
				// Focus raises the iOS picker and is the fallback when showPicker
				// needs user activation or is unavailable.
			}
		}
	}

	const toggleAttrs = $derived(nativePickerSegmentIconButtonAttrs(isEffectivelyDisabled));
	const slotAttrs = nativePickerSegmentSlotAttrs();
	const controlAttrs = $derived(
		nativePickerSegmentInputAttrs(showsOverlay, isEffectivelyDisabled, !isInputValid)
	);
	const overlayAttrs = $derived(
		nativePickerSegmentOverlayAttrs(
			!!nativeValue,
			isEffectivelyDisabled,
			!isInputValid && !!nativeValue
		)
	);
</script>

<button
	type="button"
	onclick={openPicker}
	aria-disabled={isEffectivelyDisabled || undefined}
	aria-label={openPickerLabel}
	tabindex={-1}
	class={toggleAttrs.class}
	style={toggleAttrs.style}
>
	<Icon icon="clock" size="sm" color="secondary" {...iconThemeProps} />
</button>
<span class={slotAttrs.class} style={slotAttrs.style}>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		bind:this={input}
		{id}
		type="time"
		value={initialValue}
		oninput={handleNative}
		onchange={handleNative}
		onfocus={handleFocus}
		onblur={handleBlur}
		{min}
		{max}
		step={60}
		disabled={isEffectivelyDisabled && !isFocusableDisabled}
		aria-disabled={isEffectivelyDisabled && isFocusableDisabled ? 'true' : undefined}
		readonly={(isEffectivelyDisabled && isFocusableDisabled) || undefined}
		aria-label={!ariaLabelledBy && inputLabel ? inputLabel : undefined}
		aria-labelledby={ariaLabelledBy}
		aria-describedby={ariaDescribedBy}
		autofocus={hasAutoFocus}
		data-autofocus={hasAutoFocus || undefined}
		aria-required={isEffectivelyRequired ? 'true' : undefined}
		aria-invalid={statusType === 'error' || !isInputValid ? 'true' : undefined}
		aria-busy={isBusy || undefined}
		class={controlAttrs.class}
		style={controlAttrs.style}
	/>
	{#if showsOverlay}
		<span aria-hidden="true" class={overlayAttrs.class} style={overlayAttrs.style}>
			{overlayText}
		</span>
	{/if}
</span>
<VisuallyHidden as="div" role="alert" aria-live="assertive">
	{!isInputValid ? t('@astryx.timeInput.invalidTime') : ''}
</VisuallyHidden>
