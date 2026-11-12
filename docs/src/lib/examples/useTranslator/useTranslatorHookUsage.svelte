<!--
	Ported from upstream's `templates/blocks/components/Hooks/useTranslatorHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Upstream's `InvoiceList` is a nested component so it can call `useTranslator`
	under the provider. Svelte components are their own files, so it lives in
	`InvoiceList.svelte` beside this block; that is the same split
	`useDirectionHookUsage` makes for its `Sparkline`.
-->
<script lang="ts">
	import {
		Card,
		InternationalizationProvider,
		SegmentedControl,
		SegmentedControlItem,
		VStack,
		type MessagesByLocale
	} from '@astryx-sv/core';
	import InvoiceList from './InvoiceList.svelte';

	type Locale = 'en' | 'fr';

	const MESSAGES: MessagesByLocale = {
		en: {
			'@myapp.invoices.loadMore': { defaultMessage: 'Load more' },
			'@myapp.invoices.showing': {
				defaultMessage: 'Showing {shown, number} of {total, number}'
			}
		},
		fr: {
			'@myapp.invoices.loadMore': { defaultMessage: 'Charger plus' },
			'@myapp.invoices.showing': {
				defaultMessage: '{shown, number} sur {total, number} affichées'
			}
		}
	};

	let locale = $state<Locale>('en');
</script>

<InternationalizationProvider {locale} messages={MESSAGES}>
	<Card width={360} padding={4}>
		<VStack gap={3}>
			<SegmentedControl
				label="Language"
				value={locale}
				onChange={(next) => (locale = next as Locale)}
				size="sm"
			>
				<SegmentedControlItem value="en" label="English" />
				<SegmentedControlItem value="fr" label="Français" />
			</SegmentedControl>
			<InvoiceList />
		</VStack>
	</Card>
</InternationalizationProvider>
