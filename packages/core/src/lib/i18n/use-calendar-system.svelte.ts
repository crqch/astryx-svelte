import {
	InternationalizationContext,
	type InternationalizationContextValue
} from './internationalization-context.svelte.js';
import {
	type CalendarSystem,
	isCalendarSystem,
	isCalendarSystemAvailable
} from '../utils/calendar-system.js';
import { warnOnce } from '../utils/dev-warning.js';

/**
 * Ported from Astryx's `i18n/useCalendarSystem.ts`.
 *
 * The calendar a date component shows, and the helpers that normalize a
 * calendar identifier. Upstream reads React's context during render; here the
 * resolution is returned as a getter, because Svelte reads context once at
 * initialization and a plain value would freeze a consumer at the provider's
 * mount-time calendar.
 */

/**
 * Normalizes a calendar identifier. An identifier outside `CalendarSystem`
 * resolves to `gregory` and warns once in development.
 */
export function resolveCalendarSystem(id: string, source: string): CalendarSystem {
	if (isCalendarSystem(id)) {
		return id;
	}
	warnOnce(
		`calendar-unsupported:${id}`,
		source,
		`The calendar "${id}" is not supported; showing Gregorian dates.`
	);
	return 'gregory';
}

/**
 * A calendar this runtime can show, else `gregory`. Calendars outside the
 * Gregorian-aligned set need a `Temporal` that supports them. The fallback
 * warns once for each calendar, on the server and in the browser.
 */
function availableCalendarOrGregorian(calendar: CalendarSystem, source: string): CalendarSystem {
	if (isCalendarSystemAvailable(calendar)) {
		return calendar;
	}
	warnOnce(
		`calendar-unavailable:${calendar}`,
		source,
		`The "${calendar}" calendar needs a Temporal that supports it, and this ` +
			'runtime has none; showing Gregorian dates. Load a Temporal polyfill ' +
			"with every calendar, such as 'temporal-polyfill/full/global', on the " +
			'server and in the browser.'
	);
	return 'gregory';
}

/**
 * The calendar that a caller names, without the provider: an unknown
 * identifier, or one this runtime cannot show, becomes `gregory` and warns
 * once in development.
 */
export function resolveShownCalendar(calendar: string, source: string): CalendarSystem {
	return availableCalendarOrGregorian(resolveCalendarSystem(calendar, source), source);
}

/**
 * The calendar a date component shows: its own `calendar`, else the
 * provider's resolved calendar, else `gregory`.
 *
 * A component's `calendar` may be a getter so a prop change propagates, as a
 * provider calendar swap does; a plain value is accepted for callers that own
 * no reactive prop.
 */
export function useCalendarSystem(
	calendar: CalendarSystem | undefined | (() => CalendarSystem | undefined),
	source: string
): () => CalendarSystem {
	const get = InternationalizationContext.getOr((): InternationalizationContextValue => ({
		locale: 'en',
		direction: 'ltr',
		messages: {}
	}));
	const read = typeof calendar === 'function' ? calendar : () => calendar;
	return () => resolveShownCalendar(read() ?? get().calendar ?? 'gregory', source);
}
