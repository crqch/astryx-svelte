import type { Locale, TranslatorFn } from '../../i18n/index.js';
import type { InternalConfig } from './use-internal-config.svelte.js';
import { formatDateAbsoluteCompact, formatFilterValue } from './format-filter-value.js';
import type { DateRelativeOperatorValue, FilterValue, OperatorValue } from './types.js';
import type { CalendarSystem } from '../../utils/calendar-system.js';

/**
 * The text a Filters row shows for a value, in the words the popover token
 * uses. Upstream 0.7.13 routes both through `formatTokenValue.ts`; this port's
 * older value formatter already answers the same shapes, with one difference
 * this wrapper closes: a date-only absolute value reads without a time even
 * when the operator is configured for date and time.
 *
 * Pass the untruncated budget: a row has no token width to respect.
 */
export function formatSheetValueText(
	config: InternalConfig,
	operatorValue: OperatorValue,
	filterValue: FilterValue,
	t: TranslatorFn,
	locale: Locale,
	timezoneID?: string,
	calendar: CalendarSystem = 'gregory'
): string | null {
	if (filterValue.type === 'empty') {
		return null;
	}
	if (
		filterValue.type === 'date_absolute' &&
		operatorValue.type === 'date_absolute' &&
		operatorValue.isDateOnly !== false
	) {
		return formatDateAbsoluteCompact(filterValue.unixSeconds, locale, calendar);
	}
	const text = formatFilterValue(
		config,
		operatorValue,
		filterValue,
		Number.MAX_SAFE_INTEGER,
		t,
		locale,
		timezoneID,
		calendar
	);
	return text === '' ? null : text;
}

export interface SheetChoiceOption {
	value: string;
	label: string;
}

/** The relative-date choices a value step renders, in the popover's order. */
export function buildSheetRelativeDateOptions(
	operatorValue: DateRelativeOperatorValue
): SheetChoiceOption[] {
	const result: SheetChoiceOption[] = [];
	const units = [
		{ unit: 'day', plural: 'days' },
		{ unit: 'week', plural: 'weeks' },
		{ unit: 'month', plural: 'months' }
	];
	for (const { unit, plural } of units) {
		const amounts =
			unit === 'day' ? [1, 3, 7, 14, 30] : unit === 'week' ? [1, 2, 4] : [1, 3, 6, 12];
		for (const amount of amounts) {
			if (operatorValue.isPastAllowed !== false) {
				result.push({
					value: `${amount}${unit[0]}_ago`,
					label: `${amount} ${amount === 1 ? unit : plural} ago`
				});
			}
			if (operatorValue.isFutureAllowed !== false) {
				result.push({
					value: `${amount}${unit[0]}_from_now`,
					label: `${amount} ${amount === 1 ? unit : plural} from now`
				});
			}
		}
	}
	return result;
}
