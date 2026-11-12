<!--
	Ported from upstream's `templates/blocks/components/Calendar/useCalendarConstraintsHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		Button,
		HStack,
		Text,
		useCalendarConstraints,
		useCalendarDays,
		VStack,
		type CalendarDay
	} from '@astryx-sv/core';

	// Hotel closed on Mondays (day === 1)
	const isNotMonday = (date: Date) => date.getDay() !== 1;

	let checkIn = $state<CalendarDay['date'] | null>(null);
	let checkOut = $state<CalendarDay['date'] | null>(null);

	// June 2026 season: open Jun 5 – Jun 25, max 7 nights (8-day span), closed Mondays.
	// When checkOut is already chosen, clear rangeAnchor so full season remains viewable without lingering span restrictions.
	const constraints = useCalendarConstraints(() => ({
		min: '2026-06-05',
		max: '2026-06-25',
		maxRangeSpan: 8,
		rangeAnchor: checkOut ? null : checkIn,
		dateConstraints: [isNotMonday]
	}));

	// The hook returns getters, so the object itself has to stay live.
	const grid = useCalendarDays(() => ({
		year: 2026,
		month: 6,
		weekStartsOn: 0,
		hasVariableRowCount: true
	}));

	function handleSelect(day: CalendarDay) {
		if (day.isOutside || constraints.isDateDisabled(day.date)) {
			return;
		}
		// If no check-in yet, or already booked, or clicking on/before current check-in: start new check-in
		if (!checkIn || checkOut || day.date.day <= checkIn.day) {
			checkIn = day.date;
			checkOut = null;
		} else {
			// Pick is after checkIn: set as check-out
			checkOut = day.date;
		}
	}

	function handleReset() {
		checkIn = null;
		checkOut = null;
	}
</script>

<VStack gap={3}>
	<VStack gap={1}>
		<Text type="body" weight="bold">Hotel Booking — June 2026</Text>
		<Text type="supporting" color="secondary">
			Season: Jun 5 – Jun 25 · Max stay: 7 nights · Closed Mondays
		</Text>
	</VStack>
	<HStack gap={2} vAlign="center">
		<Text type="supporting">
			{checkIn
				? checkOut
					? `Booked: Jun ${checkIn.day} – Jun ${checkOut.day}`
					: `Check-in: Jun ${checkIn.day} (pick check-out)`
				: 'Pick a check-in date'}
		</Text>
		{#if checkIn}
			<Button label="Reset" size="sm" variant="secondary" onclick={handleReset} />
		{/if}
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
						{#if day.isOutside}
							<td align="center"></td>
						{:else}
							{@const disabled = constraints.isDateDisabled(day.date)}
							{@const isSelected =
								(checkIn && checkIn.day === day.date.day && checkIn.month === day.date.month) ||
								(checkOut && checkOut.day === day.date.day && checkOut.month === day.date.month)}
							<td align="center">
								<button
									type="button"
									{disabled}
									onclick={() => handleSelect(day)}
									aria-pressed={isSelected ? 'true' : 'false'}
									aria-label={`June ${day.dayNumber}`}
									style="width: 32px; height: 32px; border-radius: 6px; border: {isSelected
										? '1px solid currentColor'
										: 'none'}; background: transparent; opacity: {disabled
										? 0.35
										: 1}; cursor: {disabled ? 'not-allowed' : 'pointer'}"
								>
									<Text type="body" color={disabled ? 'secondary' : 'primary'}>
										{day.dayNumber}
									</Text>
								</button>
							</td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</VStack>
