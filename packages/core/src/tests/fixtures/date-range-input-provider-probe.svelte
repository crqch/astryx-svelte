<script lang="ts">
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import DateRangeInput from '../../lib/components/date-range-input/date-range-input.svelte';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';

	let { locale, calendar }: { locale: string; calendar: CalendarSystem } = $props();
</script>

<InternationalizationProvider {locale} {calendar}>
	<DateRangeInput
		label="Dates"
		value={{ start: '2026-10-30', end: '2026-11-02' }}
		onChange={() => {}}
	/>
</InternationalizationProvider>
