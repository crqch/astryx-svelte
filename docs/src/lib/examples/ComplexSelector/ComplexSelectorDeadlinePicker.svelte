<!--
	Ported from upstream's `templates/blocks/components/ComplexSelector/ComplexSelectorDeadlinePicker.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		Button,
		ComplexSelector,
		DateInput,
		RadioList,
		RadioListItem,
		TimeInput,
		VStack
	} from '@astryx-sv/core';

	type ISODate = `${number}${number}${number}${number}-${number}${number}-${number}${number}`;
	type ISOTime = string & { readonly __brand: 'ISOTimeString' };

	interface Deadline {
		preset: 'today' | 'next-week' | 'custom';
		date: ISODate;
		time: ISOTime;
	}

	const presetLabels: Record<Deadline['preset'], string> = {
		today: 'Today',
		'next-week': 'Next week',
		custom: 'Custom date'
	};

	function formatDeadline(value: Deadline) {
		if (value.preset === 'custom') {
			return `${value.date} at ${value.time}`;
		}
		return presetLabels[value.preset];
	}

	let value = $state<Deadline>({
		preset: 'today',
		date: '2026-04-06' as ISODate,
		time: '17:00' as ISOTime
	});
</script>

{#snippet deadlineContent(
	selectedValue: Deadline,
	onChange: (next: Deadline) => void,
	close: () => void
)}
	{@const set = (patch: Partial<Deadline>) => onChange({ ...selectedValue, ...patch })}
	<VStack gap={4} style="width: 320px">
		<RadioList
			label="When is it due?"
			value={selectedValue.preset}
			onChange={(preset) => set({ preset: preset as Deadline['preset'] })}
		>
			<RadioListItem label="Today" value="today" />
			<RadioListItem label="Next week" value="next-week" />
			<RadioListItem label="Custom date" value="custom" />
		</RadioList>

		{#if selectedValue.preset === 'custom'}
			<VStack gap={3}>
				<DateInput
					label="Date"
					value={selectedValue.date}
					onChange={(date) => date && set({ date: date as ISODate })}
				/>
				<TimeInput
					label="Time"
					value={selectedValue.time}
					onChange={(time) => time && set({ time: time as ISOTime })}
				/>
			</VStack>
		{/if}

		<Button label="Apply" variant="primary" onclick={close} />
	</VStack>
{/snippet}

<ComplexSelector
	label="Deadline"
	description="Choose a preset or set a custom date and time."
	{value}
	onChange={(next) => (value = next)}
	triggerLabel={formatDeadline(value)}
	width={320}
	children={deadlineContent}
/>
