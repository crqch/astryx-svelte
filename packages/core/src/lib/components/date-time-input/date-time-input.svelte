<script lang="ts" module>
	import type { BaseProps } from '../../base-props.js';
	import type { SizeValue } from '../../internal/types.js';
	import type { InputStatus, InputStatusType } from '../field/types.js';
	import type { DayOfWeek, DayOfWeekName } from '../../utils/date-types.js';
	import type { CalendarSystem } from '../../utils/calendar-system.js';
	import type { LegacyNativePicker, PickerPresentation } from '../../utils/input-presentation.js';
	import type { DateTimeInputSize } from './date-time-input.stylex.js';

	/**
	 * A combined date and time in ISO 8601 form — `"YYYY-MM-DDTHH:MM"` or
	 * `"YYYY-MM-DDTHH:MM:SS"`.
	 *
	 * Branded, as `ISODateString` and `ISOTimeString` are, so a bare string cannot
	 * be passed by accident. Declared here rather than in `utils/` because that is
	 * where upstream declares it: `DateTimeInput.tsx` owns this type, and nothing
	 * else in the library uses it.
	 */
	export type ISODateTimeString = string & { readonly __brand: 'ISODateTimeString' };

	/** @deprecated Use `DateTimeInputPresentation` via the `presentation` prop. */
	export type DateTimeInputNativePicker = LegacyNativePicker;

	/** Which surfaces collect the date and time (`spec:AST-043` FR1; no `text-input` — TimeInput-only). */
	export type DateTimeInputPresentation = PickerPresentation;

	export type DateTimeInputHourFormat = '12h' | '24h';

	/** Supported minute increments for arrow-key stepping of the time field. */
	export type DateTimeInputTimeIncrement = 1 | 5 | 10 | 15 | 30;

	/**
	 * Supported minute cadences for the preset-time dropdown. Every value divides
	 * an hour evenly, so each option lands on a round clock time.
	 */
	export type DateTimeInputTimeOptionInterval = 5 | 10 | 15 | 30 | 60;

	// `DateTimeInputStatus`/`DateTimeInputStatusType` alias Field's `InputStatus`/
	// `InputStatusType`, as upstream re-exports them.
	export type DateTimeInputStatus = InputStatus;
	export type DateTimeInputStatusType = InputStatusType;

	/**
	 * `...rest` spreads onto the outer row `<div>`, hence the `HTMLDivElement`
	 * element type — the same arrangement `DateInput`/`DateRangeInput` use.
	 * Upstream's `ref` targets the *date* input; Svelte has no `ref` prop.
	 */
	export interface DateTimeInputProps extends Omit<
		BaseProps<HTMLDivElement>,
		'onchange' | 'defaultValue'
	> {
		/** Label text for the input (required for accessibility). */
		label: string;
		/**
		 * Whether to visually hide the label (still accessible to screen readers).
		 * @default false
		 */
		isLabelHidden?: boolean;
		/** Description text displayed between the label and input. */
		description?: string;
		/**
		 * Whether the field is optional. Mutually exclusive with isRequired.
		 * @default false
		 */
		isOptional?: boolean;
		/**
		 * Whether the field is required. Mutually exclusive with isOptional.
		 * @default false
		 */
		isRequired?: boolean;
		/**
		 * Whether the input is disabled.
		 * @default false
		 */
		isDisabled?: boolean;
		/**
		 * Explains why the input is disabled. When set together with `isDisabled`,
		 * the input shows a tooltip with this text on hover and keyboard focus, and
		 * the date and time fields stay focusable (via `aria-disabled`) so the
		 * reason is discoverable by keyboard and assistive technology. Typing and
		 * calendar activation stay blocked.
		 *
		 * Use this instead of wrapping a disabled input in `Tooltip` — disabled
		 * controls don't emit the pointer events an external tooltip needs.
		 */
		disabledMessage?: string;
		/** The selected datetime in ISO 8601 format. */
		value?: ISODateTimeString;
		/**
		 * Fired when the datetime changes. Called with `undefined` when the input is
		 * cleared. **Required**, unlike `DateInput`'s — upstream's own asymmetry.
		 */
		onChange: (value: ISODateTimeString | undefined) => void;
		/** Async action on change. Fires after `onChange`. */
		changeAction?: (value: ISODateTimeString | undefined) => void | Promise<void>;
		/**
		 * Whether the input is in a loading state.
		 * @default false
		 */
		isLoading?: boolean;
		/** Minimum selectable datetime in ISO format. Constrains both date and time. */
		min?: ISODateTimeString;
		/** Maximum selectable datetime in ISO format. Constrains both date and time. */
		max?: ISODateTimeString;
		/** Custom date constraint functions. A date is disabled if ANY returns false. */
		dateConstraints?: ReadonlyArray<(date: Date) => boolean>;
		/**
		 * Whether to include seconds in the time portion.
		 * @default false
		 */
		hasSeconds?: boolean;
		/**
		 * Hour display format: '12h' with the locale's day period, or '24h'.
		 * When unset, follows the `InternationalizationProvider` locale's hour
		 * cycle (`en-US` 12-hour, `en-GB` 24-hour); a per-user preference rides on
		 * the locale tag (`en-US-u-hc-h23`).
		 * @default the locale's hour cycle
		 */
		hourFormat?: DateTimeInputHourFormat;
		/**
		 * Minute step for the time field. Astryx's typed field uses it for arrow-key
		 * stepping. The default value permits the native time picker; a non-default
		 * value retains the Astryx time field because iOS does not apply native
		 * `step` as picker cadence. Ignored by the Astryx touch sheet.
		 * @default 1
		 */
		timeIncrement?: DateTimeInputTimeIncrement;
		/**
		 * Minute cadence for a dropdown of preset times on the time field. Set it to
		 * turn the time field into a combobox listing every valid time at that
		 * cadence (`60` gives the 12 AM - 11 PM list, `15` a quarter-hour list).
		 *
		 * Omitted, the time field stays a plain text input: typed entry and
		 * arrow-key stepping only, with no combobox semantics added to the
		 * accessibility tree. Typed entry keeps working when the dropdown is on —
		 * the list is a shortcut, not a restriction, so a time between two options
		 * can still be typed.
		 *
		 * Setting this prop retains Astryx's typed/combobox time field even when
		 * `nativePicker` otherwise selects native controls, because the OS picker
		 * has no equivalent preset list. The Astryx touch sheet uses wheels
		 * instead. Independent of `timeIncrement`, which governs arrow-key
		 * stepping. Setting both to the same value is the usual choice for
		 * scheduling flows.
		 */
		timeOptionInterval?: DateTimeInputTimeOptionInterval;
		/**
		 * Whether to show a clear button when a value is set.
		 * @default false
		 */
		hasClear?: boolean;
		/**
		 * Placeholder shown in the date portion when no date is selected.
		 * @default "Select a date"
		 */
		placeholder?: string;
		/**
		 * Placeholder shown in the time portion when no time is selected.
		 * @default "Select a time"
		 */
		timePlaceholder?: string;
		/**
		 * Accessible label for the time portion. Defaults to `"{label} time"` so it
		 * is tied to the field's own label and localizable, rather than a hardcoded
		 * English "Time".
		 */
		timeLabel?: string;
		/**
		 * The size of the inputs. Inherited from an enclosing `SizeContext` when unset.
		 * @default 'md'
		 */
		size?: DateTimeInputSize;
		/** Status indicator for the input. */
		status?: InputStatus;
		/**
		 * Width of the field. Numbers are treated as pixels, strings are used as-is
		 * (e.g. `'100%'`). Sizes the whole field (label, control, and status) so they
		 * stay aligned, unlike setting width via `xstyle`/`class`/`style`.
		 */
		width?: SizeValue;
		/** Tooltip text to display in an info icon at the end of the label. */
		labelTooltip?: string;
		/**
		 * Number of months to display in the calendar.
		 * @default 1
		 */
		numberOfMonths?: 1 | 2;
		/**
		 * First day of week in the calendar. Accepts a number
		 * (0 = Sunday … 6 = Saturday) or a three-letter day name ('sun'–'sat',
		 * case-insensitive).
		 * @default 0
		 */
		weekStartsOn?: DayOfWeek | DayOfWeekName;
		/**
		 * The calendar the date segment reads and writes typed dates in, and the
		 * calendar its popover and bottom sheet show. `value`, `onChange`, `min`,
		 * and `max` stay Gregorian ISO datetimes. Calendars other than `gregory`,
		 * `iso8601`, `buddhist`, `roc`, and `japanese` need `Temporal`; without it
		 * the field shows Gregorian dates.
		 * @default the InternationalizationProvider's calendar, else 'gregory'
		 */
		calendar?: CalendarSystem;

		/**
		 * When date and time picking are handed to the browser/OS instead of
		 * Astryx's calendar and time surfaces.
		 *
		 * - `'touch'` (default): native date and time inputs on a coarse primary
		 *   pointer; Astryx's typed fields and popovers otherwise
		 * - `'always'`: native date and time inputs wherever the browser supports
		 *   them
		 * - `'never'`: Astryx's own surfaces everywhere — typed fields on a fine
		 *   pointer and the coordinated Date/Time bottom sheet on a coarse pointer
		 *
		 * Native pickers cannot express `numberOfMonths`, `weekStartsOn`,
		 * `dateConstraints`, or `timeOptionInterval`. Calendar-only options are
		 * ignored in native mode and constraints are enforced on commit. The
		 * native time control is used for the default minute-precision contract;
		 * requesting `hasSeconds`, a non-default `timeIncrement`, or
		 * `timeOptionInterval` keeps Astryx's time field because iOS cannot
		 * represent those behaviors faithfully. `min` / `max` are forwarded to
		 * each native control as hints and enforced in JavaScript. `hourFormat`
		 * formats the closed value; the OS picker follows the user's locale.
		 *
		 * In a calendar other than `gregory` or `iso8601`, `'touch'` and
		 * `'always'` use Astryx's popovers on a fine pointer and the bottom sheet
		 * on a coarse pointer.
		 *
		 * @default 'touch'
		 * @deprecated Use `presentation` (`spec:AST-043` FR3):
		 * `'touch'` → `'adaptive-native'`, `'always'` → `'native'`,
		 * `'never'` → `'adaptive-bottom-sheet'`. Still works exactly as released;
		 * `presentation` wins when both are set.
		 */
		nativePicker?: DateTimeInputNativePicker;

		/**
		 * Which surfaces collect the date and time (`spec:AST-043` FR1). Every
		 * value opens pickers; the typed-fields-only `'text-input'` belongs to
		 * `TimeInput`.
		 *
		 * - `'popover'`: Astryx's typed fields + popovers on every pointer
		 * - `'bottom-sheet'`: Astryx's bottom-sheet date/time wheels on every
		 *   pointer
		 * - `'native'`: browser/OS date and time pickers on every pointer, with no
		 *   Astryx fallback (FR2), except in a calendar other than `gregory` or
		 *   `iso8601`, where it is `'adaptive-bottom-sheet'` and warns in
		 *   development
		 * - `'adaptive-bottom-sheet'`: popovers on a fine pointer, bottom sheet on
		 *   a coarse pointer
		 * - `'adaptive-native'` (default): popovers on a fine pointer, browser/OS
		 *   pickers on a coarse pointer, keeping the released per-segment Astryx
		 *   fallbacks (seconds, non-default `timeIncrement`, `timeOptionInterval`)
		 *   where a native control cannot express the value (FR2), and the bottom
		 *   sheet in a calendar other than `gregory` or `iso8601`
		 *
		 * @default 'adaptive-native'
		 */
		presentation?: DateTimeInputPresentation;
	}
</script>

<script lang="ts">
	import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
	import { useDevWarning } from '../../hooks/use-dev-warning.svelte.js';
	import { useCalendarSystem } from '../../i18n/use-calendar-system.svelte.js';
	import { useLocale } from '../../i18n/use-locale.svelte.js';
	import { isGregorianCalendar } from '../../utils/calendar-system.js';
	import { warnOnce } from '../../utils/dev-warning.js';
	import {
		calendarPickerPresentation,
		effectivePickerPresentation,
		resolvePickerPresentation
	} from '../../utils/input-presentation.js';
	import { resolveHourFormat } from '../../utils/time-format.js';
	import PointerDateTimeField from './pointer-date-time-field.svelte';
	import TouchDateTimeField from './touch-date-time-field.svelte';

	/**
	 * The pointer that decides which surface a `DateTimeInput` renders — the same
	 * test `DateInput` applies, and module-private for the same reason: nothing has
	 * asked to share it, and an export is additive later and awkward to withdraw.
	 */
	const TOUCH_POINTER_QUERY = '(pointer: coarse)';

	/**
	 * A combined date and time picker whose `presentation` prop chooses both
	 * surfaces (`spec:AST-043`). Native modes use OS-owned date and time controls
	 * in Astryx field chrome; the deprecated `nativePicker` maps to the same
	 * surfaces (FR3).
	 *
	 * ## Hydration
	 *
	 * `useMediaQuery` reports its `serverDefault` (false) during SSR, so server HTML
	 * is always the pointer surface and the swap happens on the client — the same
	 * arrangement, and the same one honest difference from upstream, that
	 * `date-input.svelte` documents.
	 *
	 * @example
	 * ```svelte
	 * <DateTimeInput label="Meeting time" value={dateTime} onChange={(v) => (dateTime = v)} />
	 * ```
	 */
	const props: DateTimeInputProps = $props();

	useDevWarning(
		'DateTimeInput',
		'`nativePicker` is deprecated; use `presentation` instead (`touch` → `adaptive-native`, `always` → `native`, `never` → `adaptive-bottom-sheet`). `presentation` wins when both are set.',
		() => props.nativePicker !== undefined
	);

	const isTouch = useMediaQuery(() => TOUCH_POINTER_QUERY);
	const calendar = useCalendarSystem(() => props.calendar, 'DateTimeInput');
	const locale = useLocale();
	const isNativeCalendar = $derived(isGregorianCalendar(calendar()));
	// The policy is the explicit `presentation`, else the released
	// `nativePicker`, else adaptive-native. In a calendar the native control
	// cannot show, both native policies become adaptive-bottom-sheet.
	const presentation = $derived(
		calendarPickerPresentation(
			effectivePickerPresentation(props.presentation, props.nativePicker),
			isNativeCalendar
		)
	);
	const surface = $derived(resolvePickerPresentation(presentation, isTouch.matches));
	// Every surface gets the resolved hour format, so typed text, the native
	// field's resting text, preset times, and the sheet wheels agree.
	const hourFormat = $derived(resolveHourFormat(locale(), props.hourFormat));
	// `forced` (`presentation="native"`, FR2) keeps no Astryx fallback. The
	// deprecated `nativePicker="always"` is `legacy` and keeps the released
	// per-segment fallbacks. A coarse-pointer adaptive-native row is `adaptive`.
	const nativeMode = $derived.by((): 'off' | 'adaptive' | 'forced' | 'legacy' => {
		if (surface !== 'native') {
			return 'off';
		}
		if (presentation !== 'native') {
			return 'adaptive';
		}
		return props.presentation === undefined && props.nativePicker === 'always'
			? 'legacy'
			: 'forced';
	});

	$effect(() => {
		const calendarShown = calendar();
		if (props.presentation === 'native' && !isGregorianCalendar(calendarShown)) {
			warnOnce(
				`presentation-native-calendar:DateTimeInput:${calendarShown}`,
				'DateTimeInput',
				`presentation="native" shows the Astryx picker in the "${calendarShown}" ` +
					'calendar, because the native date control shows only Gregorian ' +
					'dates: the popover on a fine pointer and the bottom sheet on a ' +
					'coarse pointer.'
			);
		}
	});
</script>

{#if surface === 'native'}
	<PointerDateTimeField {...props} calendar={calendar()} {hourFormat} {nativeMode} />
{:else if surface === 'sheet'}
	{#key calendar()}
		<TouchDateTimeField {...props} calendar={calendar()} {hourFormat} />
	{/key}
{:else}
	<PointerDateTimeField {...props} calendar={calendar()} {hourFormat} nativeMode="off" />
{/if}
