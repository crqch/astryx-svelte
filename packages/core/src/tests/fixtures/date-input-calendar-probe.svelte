<script lang="ts">
	import type { DateInputProps } from '../../lib/components/date-input/date-input.svelte';
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import DateInput from '../../lib/components/date-input/date-input.svelte';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';

	let {
		locale,
		props = {},
		providerCalendar,
		onChange
	}: {
		locale: string;
		props?: Partial<DateInputProps>;
		providerCalendar?: CalendarSystem;
		onChange?: (value: string | undefined) => void;
	} = $props();
</script>

<InternationalizationProvider {locale} calendar={providerCalendar}>
	<DateInput label="Date" {onChange} {...props} />
</InternationalizationProvider>
