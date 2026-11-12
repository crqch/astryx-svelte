<script lang="ts">
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';
	import Probe from './calendar-system-probe.svelte';

	let {
		provider,
		calendar
	}: {
		provider: { locale: string; calendar?: CalendarSystem } | null;
		calendar?: CalendarSystem;
	} = $props();
</script>

{#if provider}
	<InternationalizationProvider locale={provider.locale} calendar={provider.calendar}>
		<Probe {calendar} />
	</InternationalizationProvider>
{:else}
	<Probe {calendar} />
{/if}
