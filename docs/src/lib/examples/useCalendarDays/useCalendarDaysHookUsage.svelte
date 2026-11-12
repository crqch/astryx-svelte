<!--
	Ported from upstream's `templates/blocks/components/Calendar/useCalendarDaysHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		HStack,
		SegmentedControl,
		SegmentedControlItem,
		Text,
		useCalendarDays,
		VStack
	} from '@astryx-svelte/core';

	let weekStartsOn = $state<0 | 1>(0);

	// The hook returns getters, so the object itself has to stay live.
	const grid = useCalendarDays(() => ({
		year: 2026,
		month: 12,
		weekStartsOn,
		hasVariableRowCount: true
	}));
</script>

<VStack gap={3}>
	<HStack gap={2} vAlign="center">
		<Text type="body">Week starts on</Text>
		<SegmentedControl
			label="Week starts on"
			value={String(weekStartsOn)}
			onChange={(value) => (weekStartsOn = value === '1' ? 1 : 0)}
			size="sm"
		>
			<SegmentedControlItem value="0" label="Sunday" />
			<SegmentedControlItem value="1" label="Monday" />
		</SegmentedControl>
	</HStack>
	<table style="table-layout: fixed; width: 280px">
		<caption>
			<Text type="body" weight="bold">December 2026</Text>
		</caption>
		<thead>
			<tr>
				{#each grid.dayNames as name, column ((weekStartsOn + column) % 7)}
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
							<Text type="body" color={day.isOutside ? 'secondary' : 'primary'}>
								{day.dayNumber}
							</Text>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</VStack>
