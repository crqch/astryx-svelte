import { useLocale } from '../../i18n/use-locale.svelte.js';
import type { ISODateString, PlainDate } from '../../utils/date-types.js';
import {
	calendarAddMonths,
	calendarMonthOf,
	calendarYearMonthOf,
	formatCalendarMonthLabel,
	type CalendarSystem
} from '../../utils/calendar-system.js';
import { resolveShownCalendar } from '../../i18n/use-calendar-system.svelte.js';
import {
	plainDateAddDays,
	plainDateFromISO,
	plainDateToISO,
	plainDateToday
} from '../../utils/plain-date.js';

/**
 * Ported from Astryx's `Calendar/hooks/useCalendarNavigation.ts`.
 *
 * Options arrive as a getter, for the reason `useCalendarDays` documents. Two
 * things about the translation are worth naming:
 *
 * - **`internalFocusDate` is seeded once, not derived.** Upstream's lazy
 *   `useState` initialiser runs on the first render only, so a later change to
 *   `initialValue` does *not* move the visible month. A `$derived` here would
 *   have made it move, which is a different component. `$state` with an
 *   init-time seed is the exact counterpart.
 * - **The controlled test is upstream's, both halves.** Focus is controlled only
 *   when `focusDate` *and* `onFocusDateChange` are both supplied; supplying one
 *   alone falls through to the internal state. `navigateMonth` mirrors that with
 *   its own `onFocusDateChange` test rather than reusing `isControlledFocus`, so
 *   a caller passing only `onFocusDateChange` gets notified without the month
 *   ever moving — replicated, not corrected, because upstream's own tests pin it.
 */

/** Configuration for calendar navigation. */
export interface UseCalendarNavigationOptions {
	/** Initial value to determine starting month */
	initialValue?: ISODateString;
	/** Controlled focus date (which month is visible) */
	focusDate?: ISODateString;
	/** Callback when visible month changes */
	onFocusDateChange?: (focusDate: ISODateString) => void;
	/** Number of months to display */
	numberOfMonths?: 1 | 2;
	/**
	 * The calendar system whose months the hook steps and labels. Dates stay
	 * Gregorian ISO. The hook never reads the InternationalizationProvider
	 * calendar. Calendars other than gregory, iso8601, buddhist, roc, and
	 * japanese need Temporal; without it, the hook steps Gregorian months and
	 * warns once in development.
	 * @default 'gregory'
	 */
	calendar?: CalendarSystem;
}

/** Return type for the `useCalendarNavigation` hook. */
export interface UseCalendarNavigationReturn {
	/** The base month (first day of the focus month) as a PlainDate */
	readonly baseMonth: PlainDate;
	/** Array of visible months to render as PlainDates */
	readonly visibleMonths: PlainDate[];
	/**
	 * The year and month numbers of each visible month in `calendar`, as
	 * `useCalendarDays` reads them with the same `calendar`.
	 */
	readonly visibleCalendarMonths: { year: number; month: number }[];
	/** Formatted label for the month header */
	readonly monthYearLabel: string;
	/** Navigate to previous/next month */
	navigateMonth: (delta: number, focusedDate?: ISODateString, offset?: number) => void;
	/** Target date to focus after navigation */
	readonly pendingFocus: ISODateString | null;
	/** Clear the pending focus */
	clearPendingFocus: () => void;
}

/**
 * Hook for managing calendar month navigation.
 *
 * Handles the current focus date (which month is visible), previous/next
 * navigation, and pending focus for keyboard navigation across months.
 *
 * @example
 * ```ts
 * const nav = useCalendarNavigation(() => ({ initialValue: '2026-01-15', numberOfMonths: 1 }));
 *
 * nav.navigateMonth(1);            // next month
 * nav.navigateMonth(1, focused, 1); // from an arrow key, horizontal offset
 * nav.navigateMonth(1, focused, 7); // vertical offset
 * ```
 */
export function useCalendarNavigation(
	options: () => UseCalendarNavigationOptions
): UseCalendarNavigationReturn {
	const locale = useLocale();

	// Pending focus target after month navigation.
	let pendingFocus = $state<ISODateString | null>(null);

	// Internal focus date state. Seeded once at init, as upstream's lazy
	// `useState` initialiser is — see the note at the top of the file.
	const seed = options();
	let internalFocusDate = $state<PlainDate>(
		seed.focusDate
			? plainDateFromISO(seed.focusDate)
			: seed.initialValue
				? plainDateFromISO(seed.initialValue)
				: plainDateToday()
	);

	const focusDate = $derived.by((): PlainDate => {
		const { focusDate: focusDateProp, onFocusDateChange } = options();
		const isControlledFocus = focusDateProp !== undefined && onFocusDateChange !== undefined;
		return isControlledFocus ? plainDateFromISO(focusDateProp) : internalFocusDate;
	});

	const calendar = $derived(
		resolveShownCalendar(options().calendar ?? 'gregory', 'useCalendarNavigation')
	);

	const shownMonths = $derived.by(() => {
		const numberOfMonths = options().numberOfMonths ?? 1;
		const first = calendarMonthOf(calendar, focusDate);
		return Array.from({ length: numberOfMonths }, (_, i) => calendarAddMonths(calendar, first, i));
	});

	// Base month (first day of focus month).
	const baseMonth = $derived(shownMonths[0].start);
	const visibleMonths = $derived(shownMonths.map((month) => month.start));
	const visibleCalendarMonths = $derived(
		shownMonths.map((month) => calendarYearMonthOf(calendar, month))
	);

	const monthYearLabel = $derived(
		shownMonths.map((month) => formatCalendarMonthLabel(calendar, month, locale())).join(' – ')
	);

	function navigateMonth(delta: number, focusedDate?: ISODateString, offset?: number): void {
		const newMonth = calendarAddMonths(calendar, shownMonths[0], delta).start;
		const newISO = plainDateToISO(newMonth);

		// Target focus date, when one was provided.
		if (focusedDate) {
			const currentDate = plainDateFromISO(focusedDate);
			// The provided offset (1 for horizontal, 7 for vertical).
			const daysToMove = offset ?? 7;
			const targetDate = plainDateAddDays(currentDate, delta * daysToMove);
			pendingFocus = plainDateToISO(targetDate);
		}

		const { onFocusDateChange } = options();
		if (onFocusDateChange) {
			onFocusDateChange(newISO);
		} else {
			internalFocusDate = newMonth;
		}
	}

	function clearPendingFocus(): void {
		pendingFocus = null;
	}

	return {
		get baseMonth() {
			return baseMonth;
		},
		get visibleMonths() {
			return visibleMonths;
		},
		get visibleCalendarMonths() {
			return visibleCalendarMonths;
		},
		get monthYearLabel() {
			return monthYearLabel;
		},
		navigateMonth,
		get pendingFocus() {
			return pendingFocus;
		},
		clearPendingFocus
	};
}
