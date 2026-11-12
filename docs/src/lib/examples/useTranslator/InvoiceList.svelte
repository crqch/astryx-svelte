<!--
	Upstream's `InvoiceList` from `useTranslatorHookUsage.tsx`, split into its own
	file because a Svelte component must be a separate module. Content and
	behaviour are unchanged; the constant list and page size travel with it since
	nothing else in the block reads them.
-->
<script lang="ts">
	import { Button, HStack, List, ListItem, Text, VStack, useTranslator } from '@astryx-svelte/core';

	const INVOICES = Array.from({ length: 9 }, (_, index) => `INV-${1001 + index}`);
	const PAGE_SIZE = 3;

	const translate = useTranslator();
	let shownCount = $state(PAGE_SIZE);
	const total = INVOICES.length;
</script>

<VStack gap={3}>
	<List density="compact" hasDividers>
		{#each INVOICES.slice(0, shownCount) as invoice (invoice)}
			<ListItem label={invoice} />
		{/each}
	</List>
	<HStack gap={2} hAlign="between" vAlign="center">
		<Text type="supporting">
			{translate('@myapp.invoices.showing', { shown: shownCount, total })}
		</Text>
		<Button
			label={translate('@myapp.invoices.loadMore')}
			size="sm"
			isDisabled={shownCount >= total}
			onclick={() => (shownCount += PAGE_SIZE)}
		/>
	</HStack>
</VStack>
