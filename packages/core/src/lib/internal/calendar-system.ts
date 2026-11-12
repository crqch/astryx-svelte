/**
 * Ported from Astryx's `src/internal/calendar-system.ts`.
 *
 * `@astryx-sv/core/internal/calendar-system`: the hook that resolves the
 * calendar a date component shows, and the helpers that name its months and
 * days as Calendar does, for Lab components.
 *
 * An internal entry reserved for this port's own packages: undocumented,
 * outside the public API and its compatibility promise, versioned in lockstep
 * with core, and kept to named re-exports.
 */

export { useCalendarSystem } from '../i18n/use-calendar-system.svelte.js';
export {
	calendarMonthLabelDay,
	calendarMonthOf,
	formatCalendarDate,
	formatCalendarDateToParts,
	formatCalendarInstantRange
} from '../utils/calendar-system.js';
export type { CalendarSystem } from '../utils/calendar-system.js';
