<script lang="ts">
	import type { DateRangeInputProps } from '../../lib/components/date-range-input/date-range-input.svelte';
	import type { DateRange } from '../../lib/utils/date-types.js';
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import DateRangeInput from '../../lib/components/date-range-input/date-range-input.svelte';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';

	let {
		locale,
		props = {},
		providerCalendar,
		onChange
	}: {
		locale: string;
		props?: Partial<Omit<DateRangeInputProps, 'label' | 'onChange'>>;
		providerCalendar?: CalendarSystem;
		onChange: (value: DateRange | null) => void;
	} = $props();
</script>

<InternationalizationProvider {locale} calendar={providerCalendar}>
	<DateRangeInput
		label="Stay"
		value={{ start: '2026-10-30', end: '2026-11-02' }}
		{onChange}
		{...props}
	/>
</InternationalizationProvider>
