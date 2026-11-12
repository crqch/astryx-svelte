<script lang="ts">
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import Calendar from '../../lib/components/calendar/calendar.svelte';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';

	let { locale, calendar }: { locale: string; calendar: CalendarSystem } = $props();
</script>

<InternationalizationProvider {locale} {calendar}>
	<Calendar focusDate="2026-10-30" />
</InternationalizationProvider>
