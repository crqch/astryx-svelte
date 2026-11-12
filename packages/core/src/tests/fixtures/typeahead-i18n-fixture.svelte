<script lang="ts">
	import InternationalizationProvider from '$lib/i18n/internationalization-provider.svelte';
	import BaseTypeahead from '$lib/components/typeahead/base-typeahead.svelte';
	import type { Locale, MessagesByLocale, Overrides } from '$lib/i18n/types.js';
	import type { SearchableItem, SearchSource } from '$lib/components/typeahead/types.js';

	/**
	 * Upstream writes a whole `<InternationalizationProvider><BaseTypeahead/></…>`
	 * tree inline for its result-count cases. A Svelte case cannot author that
	 * JSX around `render`, so the provider and the field are one fixture.
	 */
	interface Props {
		locale: Locale;
		overrides?: Overrides;
		messages?: MessagesByLocale;
		searchSource: SearchSource<SearchableItem>;
	}

	const { locale, overrides, messages, searchSource }: Props = $props();
</script>

<InternationalizationProvider {locale} {overrides} {messages}>
	<BaseTypeahead {searchSource} value={null} onChange={() => {}} debounceMs={0} />
</InternationalizationProvider>
