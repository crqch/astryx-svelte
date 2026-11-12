<script lang="ts">
	import type { DateTimeInputProps } from '../../lib/components/date-time-input/date-time-input.svelte';
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import DateTimeInput from '../../lib/components/date-time-input/date-time-input.svelte';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';

	let {
		locale,
		props = {},
		providerCalendar,
		count = 1,
		onChange
	}: {
		locale: string;
		props?: Partial<Omit<DateTimeInputProps, 'label' | 'onChange'>>;
		providerCalendar?: CalendarSystem;
		count?: number;
		onChange: (value: string | undefined) => void;
	} = $props();
</script>

<InternationalizationProvider {locale} calendar={providerCalendar}>
	{#each Array.from({ length: count }) as _, index (index)}
		<DateTimeInput label="Meeting" {onChange} {...props} />
	{/each}
</InternationalizationProvider>
