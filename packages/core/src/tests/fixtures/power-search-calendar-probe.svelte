<script lang="ts">
	import type { CalendarSystem } from '../../lib/utils/calendar-system.js';
	import type {
		PowerSearchConfig,
		PowerSearchField,
		PowerSearchFilter,
		PowerSearchOperator
	} from '../../lib/components/power-search/types.js';
	import PowerSearch from '../../lib/components/power-search/power-search.svelte';
	import PowerSearchToken from '../../lib/components/power-search/power-search-token.svelte';
	import InternationalizationProvider from '../../lib/i18n/internationalization-provider.svelte';

	let {
		provider,
		mode,
		config,
		filter,
		field,
		operator
	}: {
		provider: { locale: string; calendar?: CalendarSystem };
		mode: 'search' | 'token';
		config: PowerSearchConfig;
		filter: PowerSearchFilter;
		field: PowerSearchField;
		operator: PowerSearchOperator;
	} = $props();
</script>

<InternationalizationProvider locale={provider.locale} calendar={provider.calendar}>
	{#if mode === 'token'}
		<PowerSearchToken {config} {filter} {field} {operator} maxLength={60} />
	{:else}
		<PowerSearch {config} filters={[filter]} onChange={() => {}} />
	{/if}
</InternationalizationProvider>
