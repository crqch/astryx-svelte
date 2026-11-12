<script lang="ts" module>
	import type { ISODateString, PlainDate } from '../../utils/date-types.js';
	import type { InputStatusType } from '../field/types.js';

	export interface NativeDateSegmentProps {
		id: string;
		value?: ISODateString;
		onChange: (value: ISODateString | undefined) => void;
		placeholder: string;
		min?: ISODateString;
		max?: ISODateString;
		isDateDisabled: (date: PlainDate) => boolean;
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
	import { parseDateInput } from '../../utils/date-parser.js';
	import { formatSharedDate, plainDateFromISO, plainDateToISO } from '../../utils/plain-date.js';
	import { themeProps } from '../../internal/theme-props.js';
	import Icon from '../icon/icon.svelte';
	import VisuallyHidden from '../visually-hidden/visually-hidden.svelte';
	import {
		nativePickerSegmentIconButtonAttrs,
		nativePickerSegmentInputAttrs,
		nativePickerSegmentOverlayAttrs,
		nativePickerSegmentSlotAttrs
	} from './native-picker-segment.stylex.js';

	/**
	 * The OS-picker date half of `DateTimeInput`, ported from Astryx's
	 * `DateTimeInput/NativeDateSegment.tsx`.
	 *
	 * Hands date picking to the platform through `<input type="date">`. Its
	 * sibling `native-time-segment.svelte` hands time picking to
	 * `<input type="time">`, so both halves of `DateTimeInput` follow the same
	 * surface choice.
	 *
	 * The input is deliberately uncontrolled and observed through native event
	 * listeners. On iOS, writing its value while the picker sheet is open can
	 * detach the sheet, and native picker edits do not reliably reach a
	 * framework's synthetic change layer. External values therefore reconcile
	 * only while unfocused.
	 *
	 * Internal to `DateTimeInput`; not exported from the barrel, exactly as
	 * upstream keeps it out of `DateTimeInput/index.ts`.
	 */
	let {
		id,
		value,
		onChange,
		placeholder,
		min,
		max,
		isDateDisabled,
		isEffectivelyDisabled,
		isFocusableDisabled,
		isEffectivelyRequired,
		isBusy,
		statusType,
		ariaDescribedBy
	}: NativeDateSegmentProps = $props();

	const t = useTranslator();
	const locale = useLocale();
	const isTouchPointer = useMediaQuery(() => '(pointer: coarse)');

	let input = $state<HTMLInputElement | null>(null);

	let rejectedValue = $state<string | null>(null);
	let isFocused = $state(false);
	let isSegmentEditable = $state(false);
	let valueAtFocus: string | null = null;
	let lastCommit: string | null = null;

	// Upstream's render-phase `prevValueRef` reset, in the shape the rest of this
	// port uses: a plain `let` compared inside a pre-effect, so the comparison
	// happens before the render that consumes it. `rejectedValue` is written
	// here, so the body is untracked.
	// svelte-ignore state_referenced_locally
	let prevValue: ISODateString | undefined = value;
	$effect.pre(() => {
		const next = value;
		untrack(() => {
			if (next !== prevValue) {
				prevValue = next;
				// Keep the accepted DOM value cached while a native picker is open.
				// An optimistic rollback changes the prop but leaves the focused
				// control alone; clearing this cache would replay that rejected edit
				// on blur.
				if (!isFocused) {
					lastCommit = null;
				}
				if (rejectedValue !== null) {
					rejectedValue = null;
				}
			}
		});
	});

	const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
	const nativeValue = $derived(value && ISO_DATE.test(value) ? value : '');
	const isInputValid = $derived(rejectedValue === null);
	const overlayText = $derived(
		nativeValue
			? formatSharedDate(plainDateFromISO(nativeValue as ISODateString), 'date_long', locale())
			: placeholder
	);
	const showsOverlay = $derived(!!overlayText && !(isFocused && isSegmentEditable));

	function commitValue(newValue: string): void {
		if (isEffectivelyDisabled) {
			return;
		}
		if (lastCommit === newValue) {
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

		const parsed = parseDateInput(newValue, locale());
		if (!parsed) {
			return;
		}
		if (isDateDisabled(parsed)) {
			rejectedValue = newValue;
			return;
		}

		rejectedValue = null;
		lastCommit = newValue;
		const parsedISO = plainDateToISO(parsed);
		if (parsedISO !== value) {
			onChange(parsedISO);
		}
	}

	function handleNative(event: Event): void {
		commitValue((event.target as HTMLInputElement).value);
	}

	// The value the control mounts with. Deliberately captured once: writing to
	// the element while the picker sheet is open detaches the sheet from the
	// field on iOS, so the template touches the element exactly once, at mount;
	// the effect below owns every later update and only writes while unfocused.
	// svelte-ignore state_referenced_locally
	const initialValue = value && ISO_DATE.test(value) ? value : '';

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
				// Focus is the fallback when showPicker needs user activation or the
				// browser does not expose it for date controls.
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
	aria-label={t('@astryx.dateInput.openCalendar')}
	tabindex={-1}
	class={toggleAttrs.class}
	style={toggleAttrs.style}
>
	<Icon
		icon="calendar"
		size="sm"
		color="secondary"
		{...themeProps('date-time-input-toggle-icon', { state: 'collapsed' })}
	/>
</button>
<span class={slotAttrs.class} style={slotAttrs.style}>
	<!--
		UNCONTROLLED on purpose, with a value nothing rewrites after mount —
		`initialValue` is a plain const, so the template's own write happens
		once; see it and the sync effect above.
	-->
	<input
		bind:this={input}
		{id}
		type="date"
		value={initialValue}
		oninput={handleNative}
		onchange={handleNative}
		onfocus={handleFocus}
		onblur={handleBlur}
		{min}
		{max}
		disabled={isEffectivelyDisabled && !isFocusableDisabled}
		aria-disabled={isEffectivelyDisabled && isFocusableDisabled ? 'true' : undefined}
		readonly={(isEffectivelyDisabled && isFocusableDisabled) || undefined}
		aria-describedby={ariaDescribedBy}
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
	{!isInputValid ? t('@astryx.dateInput.invalidDate') : ''}
</VisuallyHidden>
