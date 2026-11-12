<script lang="ts">
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import type {
		UseCalendarNavigationOptions,
		UseCalendarNavigationReturn
	} from '../../lib/components/calendar/use-calendar-navigation.svelte.js';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';
	import CalendarNavigationHookProbe from './calendar-navigation-hook-probe.svelte';

	let {
		options,
		provider
	}: {
		options: UseCalendarNavigationOptions;
		provider?: { locale: string; calendar?: CalendarSystem };
	} = $props();

	let inner = $state<{ getNavigation(): UseCalendarNavigationReturn } | null>(null);

	export const getNavigation = (): UseCalendarNavigationReturn => {
		if (inner == null) {
			throw new Error('calendar navigation probe not mounted');
		}
		return inner.getNavigation();
	};
</script>

{#if provider}
	<InternationalizationProvider locale={provider.locale} calendar={provider.calendar}>
		<CalendarNavigationHookProbe {options} bind:this={inner} />
	</InternationalizationProvider>
{:else}
	<CalendarNavigationHookProbe {options} bind:this={inner} />
{/if}
