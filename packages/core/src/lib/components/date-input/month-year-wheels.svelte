<script lang="ts" module>
	import type { MonthModel } from './month-geometry.js';

	export interface MonthYearWheelsProps {
		/** The calendar's months, by index. */
		monthModel: MonthModel;
		/** The month the wheels currently show. */
		monthIndex: number;
		/** First reachable month. */
		minMonthIndex: number;
		/** Last reachable month. */
		maxMonthIndex: number;
		/** Fired when either wheel comes to rest on a new month. */
		onChange: (monthIndex: number) => void;
		/** Accessible name for the month wheel. */
		monthLabel: string;
		/** Accessible name for the year wheel. */
		yearLabel: string;
		/** False while the panel is hidden. */
		isActive?: boolean;
		/**
		 * The day of the month the picker keeps, such as the selected date's. A
		 * year that spans an era change is labeled with the era of this day in the
		 * selected month. The first day of the month applies when it is absent.
		 */
		keptDay?: number;
	}
</script>

<script lang="ts">
	import {
		calendarYearSpansEras,
		formatCalendarMonthName,
		formatCalendarYearLabel
	} from '../../utils/calendar-system.js';
	import { useLocale } from '../../i18n/use-locale.svelte.js';
	import Wheel, { type WheelOption } from './wheel.svelte';
	import { clampIndex } from './month-geometry.js';
	import { monthYearWheelsAttrs } from './month-year-wheels.stylex.js';

	/**
	 * Month and year wheels, bounded by the same range as the scroller. Ported
	 * from Astryx's `DateInput/MonthYearWheels.tsx`.
	 *
	 * The shortcut out of continuous scrolling. Scrolling is the right gesture
	 * for "a month or two either way" and the wrong one for "December 2019", so
	 * the header title opens this instead: two wheels, one flick each.
	 *
	 * Internal to `DateInput`; not exported from the barrel, exactly as upstream
	 * keeps it out of `DateInput/index.ts`.
	 */
	let {
		monthModel,
		monthIndex,
		minMonthIndex,
		maxMonthIndex,
		onChange,
		monthLabel,
		yearLabel,
		isActive = true,
		keptDay = 1
	}: MonthYearWheelsProps = $props();

	const locale = useLocale();
	const calendar = $derived(monthModel.calendar);
	const parts = $derived(monthModel.yearMonthAt(monthIndex));

	// Months outside the range stay on the wheel rather than vanishing: a list
	// whose length changes with the range would jump under the finger. Only the
	// calendar changes its length, for a year with a leap month.
	const monthOptions: WheelOption[] = $derived(
		Array.from({ length: monthModel.monthsInYear(parts.year) }, (_, index) => {
			const candidate = monthModel.indexOfYearMonth(parts.year, index + 1);
			return {
				value: index + 1,
				label: formatCalendarMonthName(calendar, monthModel.monthAt(candidate), locale()),
				isDisabled: candidate < minMonthIndex || candidate > maxMonthIndex
			};
		})
	);

	// Every listed year holds a reachable month: the list runs from the year of
	// the first reachable month to the year of the last.
	const years = $derived.by(() => {
		const first = monthModel.yearMonthAt(minMonthIndex).year;
		const last = monthModel.yearMonthAt(maxMonthIndex).year;
		const out: { value: number; label: string; spansEras: boolean }[] = [];
		for (let candidate = first; candidate <= last; candidate++) {
			out.push({
				value: candidate,
				label: formatCalendarYearLabel(calendar, candidate, locale()),
				spansEras: calendarYearSpansEras(calendar, candidate, locale())
			});
		}
		return out;
	});

	// A year with an era change takes the era of the shown date, as iOS does.
	// Its row text changes as the month turns. Each row keeps one fixed size.
	const yearOptions: WheelOption[] = $derived(
		years.map(({ value, label, spansEras }) => ({
			value,
			label: spansEras
				? formatCalendarYearLabel(calendar, value, locale(), {
						month: parts.month,
						day: keptDay
					})
				: label
		}))
	);

	const attrs = monthYearWheelsAttrs();
</script>

<div class={attrs.class} style={attrs.style}>
	<Wheel
		label={monthLabel}
		options={monthOptions}
		value={parts.month}
		{isActive}
		onChange={(nextMonth) => onChange(monthModel.indexOfYearMonth(parts.year, nextMonth))}
	/>
	<Wheel
		label={yearLabel}
		options={yearOptions}
		value={parts.year}
		{isActive}
		onChange={(nextYear) => {
			// The same month of the new year, or its common counterpart when the
			// new year lacks a leap month (Adar I becomes Adar). A year change can
			// still land outside the range; clamp to it.
			const candidate = monthModel.shiftYears(monthIndex, nextYear - parts.year);
			onChange(clampIndex(candidate, minMonthIndex, maxMonthIndex));
		}}
	/>
</div>
