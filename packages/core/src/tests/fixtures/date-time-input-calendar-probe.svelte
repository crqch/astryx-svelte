<script lang="ts">
	import type { DateTimeInputProps } from '../../lib/components/date-time-input/date-time-input.svelte';
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import DateTimeInput from '../../lib/components/date-time-input/date-time-input.svelte';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';

	let {
		locale,
		props = {},
		providerCalendar,
		onChange
	}: {
		locale: string;
		props?: Partial<Omit<DateTimeInputProps, 'label' | 'onChange'>>;
		providerCalendar?: CalendarSystem;
		onChange: (value: string | undefined) => void;
	} = $props();
</script>

<InternationalizationProvider {locale} calendar={providerCalendar}>
	<DateTimeInput label="Meeting" {onChange} {...props} />
</InternationalizationProvider>
