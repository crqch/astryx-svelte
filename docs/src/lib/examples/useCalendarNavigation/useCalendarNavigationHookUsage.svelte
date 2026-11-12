<!--
	Ported from upstream's `templates/blocks/components/Calendar/useCalendarNavigationHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	One API translation: upstream seeds the grid from
	`visibleCalendarMonths[0]`. The port has no calendar-system option and returns
	only the Gregorian first days as `visibleMonths`; its first entry carries the
	same year/month pair under the default calendar.
-->
<script lang="ts">
	import {
		Button,
		HStack,
		Text,
		useCalendarDays,
		useCalendarNavigation,
		VStack,
		type CalendarDay,
		type ISODateString
	} from '@astryx-svelte/core';

	let focusDate = $state<ISODateString>('2026-06-01');

	const nav = useCalendarNavigation(() => ({
		focusDate,
		onFocusDateChange: (next) => (focusDate = next),
		numberOfMonths: 1
	}));

	// The hook returns getters, so the object itself has to stay live.
	const grid = useCalendarDays(() => ({
		...nav.visibleMonths[0],
		weekStartsOn: 0,
		hasVariableRowCount: true
	}));

	const dayButtonRefs = new Map<string, HTMLButtonElement>();

	// Move focus to target date when navigating across month boundaries
	$effect(() => {
		const target = nav.pendingFocus;
		if (target) {
			const el = dayButtonRefs.get(target);
			if (el) {
				el.focus();
				nav.clearPendingFocus();
			}
		}
	});

	// Arrow key navigation moving across days and month boundaries with RTL awareness (DR6, DR11)
	function handleKeyDown(e: KeyboardEvent, day: CalendarDay) {
		if (day.isOutside) {
			return;
		}

		const target = e.currentTarget as HTMLElement | null;
		const isRtl =
			typeof window !== 'undefined' &&
			target != null &&
			getComputedStyle(target).direction === 'rtl';

		const isNext = isRtl ? e.key === 'ArrowLeft' : e.key === 'ArrowRight';
		const isPrev = isRtl ? e.key === 'ArrowRight' : e.key === 'ArrowLeft';

		if (isNext) {
			e.preventDefault();
			const inMonthDays = grid.weeks.flatMap((w) => w.filter((d) => !d.isOutside));
			const currentIndex = inMonthDays.findIndex((d) => d.iso === day.iso);
			if (currentIndex === inMonthDays.length - 1) {
				// Last day of month: advance month and focus next day across boundary
				nav.navigateMonth(1, day.iso, 1);
			} else {
				const nextDay = inMonthDays[currentIndex + 1];
				dayButtonRefs.get(nextDay.iso)?.focus();
			}
		} else if (isPrev) {
			e.preventDefault();
			const inMonthDays = grid.weeks.flatMap((w) => w.filter((d) => !d.isOutside));
			const currentIndex = inMonthDays.findIndex((d) => d.iso === day.iso);
			if (currentIndex === 0) {
				// First day of month: step back month and focus previous day across boundary
				nav.navigateMonth(-1, day.iso, 1);
			} else {
				const prevDay = inMonthDays[currentIndex - 1];
				dayButtonRefs.get(prevDay.iso)?.focus();
			}
		}
	}
</script>

<VStack gap={3} width={280}>
	<HStack gap={2} vAlign="center" hAlign="between">
		<Button
			label="Previous"
			size="sm"
			variant="secondary"
			onclick={() => nav.navigateMonth(-1)}
			aria-label="Previous month"
		/>
		<Text type="body" weight="bold">{nav.monthYearLabel}</Text>
		<Button
			label="Next"
			size="sm"
			variant="secondary"
			onclick={() => nav.navigateMonth(1)}
			aria-label="Next month"
		/>
	</HStack>

	<table style="table-layout: fixed; width: 280px">
		<thead>
			<tr>
				{#each grid.dayNames as name, i (i)}
					<th scope="col">
						<Text type="supporting" color="secondary">{name}</Text>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each grid.weeks as week (week[0].iso)}
				<tr>
					{#each week as day (day.iso)}
						<td align="center">
							<button
								type="button"
								{@attach (el) => {
									dayButtonRefs.set(day.iso, el);
									return () => dayButtonRefs.delete(day.iso);
								}}
								disabled={day.isOutside}
								aria-hidden={day.isOutside || undefined}
								onkeydown={(e) => handleKeyDown(e, day)}
								aria-label={day.isOutside ? undefined : `${nav.monthYearLabel} ${day.dayNumber}`}
								tabindex={day.isOutside ? -1 : 0}
								style="width: 32px; height: 32px; border-radius: 6px; border: none; background: transparent; opacity: {day.isOutside
									? 0.35
									: 1}; cursor: {day.isOutside ? 'not-allowed' : 'pointer'}"
							>
								<Text type="body" color={day.isOutside ? 'secondary' : 'primary'}>
									{day.dayNumber}
								</Text>
							</button>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</VStack>
