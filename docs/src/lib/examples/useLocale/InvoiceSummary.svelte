<!--
	The `InvoiceSummary` function component from upstream's
	`templates/blocks/components/Hooks/useLocaleHookUsage.tsx`. Svelte has no
	in-file component declaration, so it is a sibling module; the example
	registry only looks for `<BlockName>.svelte`, so this file is never listed.
-->
<script lang="ts">
	import { HStack, Text, VStack, useLocale } from '@astryx-sv/core';

	const ISSUED_ON = new Date(2026, 10, 2);
	const AMOUNT_DUE = 1234.5;

	// `useLocale()` returns a getter; reading it inside `$derived` is what makes
	// the formats follow a provider locale swap.
	const locale = useLocale();
	const issuedOn = $derived(
		new Intl.DateTimeFormat(locale(), {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(ISSUED_ON)
	);
	const amountDue = $derived(
		new Intl.NumberFormat(locale(), {
			style: 'currency',
			currency: 'USD'
		}).format(AMOUNT_DUE)
	);
</script>

<VStack gap={1}>
	<HStack justify="between">
		<Text type="body" color="secondary">Issued</Text>
		<Text type="body">{issuedOn}</Text>
	</HStack>
	<HStack justify="between">
		<Text type="body" color="secondary">Amount due</Text>
		<Text type="body" weight="bold">{amountDue}</Text>
	</HStack>
</VStack>
