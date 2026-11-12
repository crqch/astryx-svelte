import { useLocale } from '../../i18n/use-locale.svelte.js';
import { useCalendarSystem } from '../../i18n/use-calendar-system.svelte.js';
import { useTranslator } from '../../i18n/use-translator.svelte.js';
import { type CalendarSystem, isGregorianCalendar } from '../../utils/calendar-system.js';
import {
	type CalendarDateParseResult,
	calendarDisplayName,
	formatCalendarDateHint,
	formatCalendarDateText,
	getCalendarDateLexicon,
	parseCalendarDate
} from '../../utils/calendar-date-parser.js';
import type { ISODateString, PlainDate } from '../../utils/date-types.js';
import { parseDateInput } from '../../utils/date-parser.js';
import {
	nearestAcceptedDate,
	plainDateFromISO,
	plainDateIsAfter,
	plainDateIsBefore,
	plainDateToday,
	type SharedDateFormat
} from '../../utils/plain-date.js';

/**
 * Ported from Astryx's `DateInput/useTypedDate.ts` (the reading and formatting
 * half). Upstream's typed-entry state machine lives in `useTypedDateField` and
 * is not reproduced: this port's three date surfaces own their pending-input
 * handling, and only need the calendar-aware reading and committed text.
 */

/** A rejected typed date, by the message it announces. */
export type TypedDateError = 'unreadable' | 'nonexistent' | 'outOfRange';

export interface UseTypedDateOptions {
	/** The component that names itself in development warnings. */
	source: string;
	/** The field's own calendar; the provider's calendar applies otherwise. */
	calendar?: CalendarSystem;
	/** The committed display format. */
	format: SharedDateFormat | ((value: ISODateString) => string);
	min?: ISODateString;
	max?: ISODateString;
	isDateDisabled: (date: PlainDate) => boolean;
}

export interface TypedDate {
	/** The resolved calendar, for the field's Calendar. */
	readonly calendar: CalendarSystem;
	/** Builds the lexicon ahead of the first keystroke. */
	prepare: () => void;
	parse: (text: string) => CalendarDateParseResult;
	formatCommitted: (value: ISODateString) => string;
	/**
	 * An example date for an empty focused field, or null for Gregorian. The
	 * example is today when the field accepts it, else the nearest date it
	 * accepts.
	 */
	getFormatHint: () => string | null;
	/** Names the calendar, or null when it is the provider's calendar. */
	calendarDescription: string | null;
	/** The message for a rejected result. */
	errorMessage: (result: CalendarDateParseResult) => string;
}

/** The rejection a result shows: errors of complete text, or of committed text. */
export function typedDateError(
	result: CalendarDateParseResult | null,
	isCommitted: boolean
): TypedDateError | null {
	if (result == null) {
		return null;
	}
	if (result.kind === 'unreadable' || (result.kind === 'incomplete' && isCommitted)) {
		return 'unreadable';
	}
	if (
		(result.kind === 'nonexistent' || result.kind === 'outOfRange') &&
		(result.isComplete || isCommitted)
	) {
		return result.kind;
	}
	return null;
}

export function useTypedDate(options: () => UseTypedDateOptions): TypedDate {
	const locale = useLocale();
	const t = useTranslator();
	const calendar = useCalendarSystem(() => options().calendar, options().source);
	// The provider's calendar, without this field's own prop: equal to the shown
	// calendar unless the field overrides it, which is when a description helps.
	const providerCalendar = useCalendarSystem(undefined, options().source);

	function prepare(): void {
		getCalendarDateLexicon(locale(), calendar());
	}

	function parse(text: string): CalendarDateParseResult {
		const { format, isDateDisabled } = options();
		const result = parseCalendarDate(text, getCalendarDateLexicon(locale(), calendar()), {
			isoIsGregorian: format === 'system_date',
			isDateDisabled
		});
		if (
			!isGregorianCalendar(calendar()) ||
			(result.kind !== 'unreadable' && result.kind !== 'nonexistent')
		) {
			return result;
		}
		// Gregorian text that only parseDateInput reads still commits, on Enter
		// or blur only: it is never complete while the person types.
		const date = parseDateInput(text, locale());
		if (date == null) {
			return result;
		}
		return isDateDisabled(date)
			? { kind: 'outOfRange', date, isComplete: false }
			: { kind: 'value', date, isComplete: false };
	}

	function formatCommitted(value: ISODateString): string {
		const { format } = options();
		return typeof format === 'function'
			? format(value)
			: formatCalendarDateText(plainDateFromISO(value), format, locale(), calendar());
	}

	function getFormatHint(): string | null {
		if (isGregorianCalendar(calendar())) {
			return null;
		}
		const { min, max, isDateDisabled } = options();
		const example = nearestAcceptedDate(plainDateToday(), {
			min: min != null ? plainDateFromISO(min) : null,
			max: max != null ? plainDateFromISO(max) : null,
			isDateDisabled
		});
		return t('@astryx.dateInput.formatHint', {
			example: formatCalendarDateHint(example, locale(), calendar())
		});
	}

	const calendarDescription = (): string | null => {
		const shown = calendar();
		const provider = providerCalendar();
		// A Gregorian field in a Gregorian provider needs no description, and
		// iso8601 is Gregorian text under another name.
		const isProviderCalendar = isGregorianCalendar(shown)
			? isGregorianCalendar(provider)
			: shown === provider;
		if (isProviderCalendar) {
			return null;
		}
		return t('@astryx.dateInput.calendarDescription', {
			calendar: calendarDisplayName(shown, locale())
		});
	};

	function errorMessage(result: CalendarDateParseResult): string {
		if (result.kind === 'nonexistent') {
			return t('@astryx.dateInput.nonexistentDate', {
				calendar: calendarDisplayName(calendar(), locale())
			});
		}
		if (result.kind === 'outOfRange') {
			const { format, min, max } = options();
			const boundFormat = typeof format === 'function' ? 'date_long' : format;
			const writeBound = (bound: ISODateString) =>
				formatCalendarDateText(plainDateFromISO(bound), boundFormat, locale(), calendar());
			const isBeforeMin = min != null && plainDateIsBefore(result.date, plainDateFromISO(min));
			const isAfterMax = max != null && plainDateIsAfter(result.date, plainDateFromISO(max));
			const bounds =
				!isBeforeMin && !isAfterMax
					? 'none'
					: min != null && max != null
						? 'both'
						: min != null
							? 'min'
							: 'max';
			return t('@astryx.dateInput.outOfRangeDate', {
				bounds,
				min: min != null ? writeBound(min) : '',
				max: max != null ? writeBound(max) : ''
			});
		}
		return t('@astryx.dateInput.invalidDate');
	}

	return {
		get calendar() {
			return calendar();
		},
		prepare,
		parse,
		formatCommitted,
		getFormatHint,
		get calendarDescription() {
			return calendarDescription();
		},
		errorMessage
	};
}
