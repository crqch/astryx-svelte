<script lang="ts">
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import type {
		UseCalendarDaysOptions,
		UseCalendarDaysReturn
	} from '../../lib/components/calendar/use-calendar-days.svelte.js';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';
	import CalendarDaysHookProbe from './calendar-days-hook-probe.svelte';

	let {
		options,
		provider
	}: {
		options: UseCalendarDaysOptions;
		provider?: { locale: string; calendar?: CalendarSystem };
	} = $props();

	let inner = $state<{ getGrid(): UseCalendarDaysReturn } | null>(null);

	export const getGrid = (): UseCalendarDaysReturn => {
		if (inner == null) {
			throw new Error('calendar days probe not mounted');
		}
		return inner.getGrid();
	};
</script>

{#if provider}
	<InternationalizationProvider locale={provider.locale} calendar={provider.calendar}>
		<CalendarDaysHookProbe {options} bind:this={inner} />
	</InternationalizationProvider>
{:else}
	<CalendarDaysHookProbe {options} bind:this={inner} />
{/if}
