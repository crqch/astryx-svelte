/**
 * Ported from Astryx's `__tests__/temporalAheadOfIntl.ts`.
 *
 * Runs a callback with a Temporal whose `chinese` calendar starts a month one
 * day before Intl does, as native Temporal is at some month starts.
 */

interface TestPlainDate {
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly daysInMonth: number;
	with(fields: { day: number }): TestPlainDate;
	add(duration: object): TestPlainDate;
	subtract(duration: object): TestPlainDate;
	withCalendar(calendar: string): TestPlainDate;
}

type TestPlainDateConstructor = new (
	isoYear: number,
	isoMonth: number,
	isoDay: number,
	calendar: string
) => TestPlainDate;

export function withChineseTemporalAheadOfIntl<T>(run: () => T): T {
	const globals = globalThis as unknown as {
		Temporal: { PlainDate: TestPlainDateConstructor };
	};
	const real = globals.Temporal;
	// Native Temporal already places 2027-02-06 one day ahead of Intl here. The
	// upstream polyfill agrees with Intl, so its helper had to add the day. Only
	// shift the native date when the two still agree.
	const intlDay = new Intl.DateTimeFormat('en', {
		calendar: 'chinese',
		day: 'numeric',
		timeZone: 'UTC'
	})
		.formatToParts(new Date('2027-02-06T12:00:00Z'))
		.find((part) => part.type === 'day')?.value;
	if (Number(intlDay) !== new real.PlainDate(2027, 2, 6, 'chinese').day) {
		return run();
	}
	const shift = (inner: TestPlainDate): TestPlainDate => ({
		year: inner.year,
		month: inner.month,
		day: inner.day,
		daysInMonth: inner.daysInMonth,
		with: (fields) => shift(inner.with(fields)),
		add: (duration) => shift(inner.add(duration)),
		subtract: (duration) => shift(inner.subtract(duration)),
		withCalendar: (calendar) => inner.withCalendar(calendar).subtract({ days: 1 })
	});
	function PlainDate(y: number, m: number, d: number, calendar: string) {
		return calendar === 'chinese'
			? shift(new real.PlainDate(y, m, d, 'iso8601').add({ days: 1 }).withCalendar('chinese'))
			: new real.PlainDate(y, m, d, calendar);
	}
	globals.Temporal = {
		PlainDate: PlainDate as unknown as TestPlainDateConstructor
	};
	try {
		return run();
	} finally {
		globals.Temporal = real;
	}
}
