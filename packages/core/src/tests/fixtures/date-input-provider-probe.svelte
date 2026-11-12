<script lang="ts">
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import DateInput from '../../lib/components/date-input/date-input.svelte';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';

	let { locale, calendar }: { locale: string; calendar: CalendarSystem } = $props();
</script>

<InternationalizationProvider {locale} {calendar}>
	<DateInput label="Date" value="2026-10-30" onChange={() => {}} />
</InternationalizationProvider>
