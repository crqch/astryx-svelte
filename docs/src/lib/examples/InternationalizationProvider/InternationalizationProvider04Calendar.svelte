<!--
	Ported from upstream's
	`templates/blocks/components/InternationalizationProvider/InternationalizationProvider04Calendar.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		Calendar,
		DateInput,
		InternationalizationProvider,
		SegmentedControl,
		SegmentedControlItem,
		Text,
		VStack,
		type ISODateString
	} from '@astryx-svelte/core';

	type CalendarSystem = 'gregory' | 'japanese' | 'buddhist';

	let calendar = $state<CalendarSystem>('japanese');
	let value = $state<ISODateString | undefined>('2026-10-30');
</script>

<InternationalizationProvider locale="en" {calendar}>
	<VStack gap={4} hAlign="center">
		<SegmentedControl
			label="Calendar"
			value={calendar}
			onChange={(next: string) => (calendar = next as CalendarSystem)}
			size="sm"
		>
			<SegmentedControlItem value="gregory" label="Gregorian" />
			<SegmentedControlItem value="japanese" label="Japanese" />
			<SegmentedControlItem value="buddhist" label="Buddhist" />
		</SegmentedControl>
		<DateInput
			label="Start date"
			{value}
			onChange={(next: ISODateString | undefined) => (value = next)}
			width={300}
		/>
		<Calendar {value} onChange={(next: ISODateString | undefined) => (value = next)} />
		<Text type="supporting" color="secondary">
			{value ? `Value: ${value}` : 'No date'}
		</Text>
	</VStack>
</InternationalizationProvider>
