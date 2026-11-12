<script lang="ts">
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import DateTimeInput, {
		type ISODateTimeString
	} from '../../lib/components/date-time-input/date-time-input.svelte';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';

	let { locale, calendar }: { locale: string; calendar: CalendarSystem } = $props();
</script>

<InternationalizationProvider {locale} {calendar}>
	<DateTimeInput label="When" value={'2026-10-30T09:00' as ISODateTimeString} onChange={() => {}} />
</InternationalizationProvider>
