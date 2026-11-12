import { useLocale } from '../../i18n/use-locale.svelte.js';
import { useCalendarSystem } from '../../i18n/use-calendar-system.svelte.js';
import { type CalendarSystem, isGregorianCalendar } from '../../utils/calendar-system.js';
import {
	type CalendarDateParseResult,
	formatCalendarDateText,
	getCalendarDateLexicon,
	parseCalendarDate
} from '../../utils/calendar-date-parser.js';
import type { ISODateString, PlainDate } from '../../utils/date-types.js';
import { parseDateInput } from '../../utils/date-parser.js';
import { plainDateFromISO, type SharedDateFormat } from '../../utils/plain-date.js';

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
	const calendar = useCalendarSystem(() => options().calendar, options().source);

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

	return {
		get calendar() {
			return calendar();
		},
		prepare,
		parse,
		formatCommitted
	};
}
