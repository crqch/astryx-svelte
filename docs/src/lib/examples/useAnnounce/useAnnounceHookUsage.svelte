<!--
	Ported from upstream's `templates/blocks/components/Hooks/useAnnounceHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Card, List, ListItem, Text, TextInput, VStack } from '@astryx-svelte/core';
	import { useAnnounce } from '@astryx-svelte/core/hooks';

	const PRODUCTS = [
		'Desk lamp',
		'Desk organizer',
		'Standing desk',
		'Office chair',
		'Chair mat',
		'Monitor arm',
		'Monitor stand',
		'Keyboard tray'
	];

	const ANNOUNCE_DELAY_MS = 500;

	function filterProducts(query: string): string[] {
		const needle = query.trim().toLowerCase();
		return PRODUCTS.filter((product) => product.toLowerCase().includes(needle));
	}

	// This port's `useAnnounce` takes no options; upstream's `hasReplace: true`
	// is the default replacement behaviour here.
	const announce = useAnnounce();

	let query = $state('');
	let timer: ReturnType<typeof setTimeout> | null = null;
	const matches = $derived(filterProducts(query));
	const count = $derived(matches.length);

	function handleChange(value: string) {
		query = value;
		if (timer != null) {
			clearTimeout(timer);
			timer = null;
		}
		if (value === '') {
			return;
		}
		const nextCount = filterProducts(value).length;
		timer = setTimeout(() => {
			timer = null;
			announce(
				nextCount === 0 ? 'No results' : `${nextCount} ${nextCount === 1 ? 'result' : 'results'}`
			);
		}, ANNOUNCE_DELAY_MS);
	}

	// A count still pending at unmount would be spoken for a filter that is gone.
	$effect(() => {
		return () => {
			if (timer != null) {
				clearTimeout(timer);
			}
		};
	});
</script>

<Card width={360} padding={4}>
	<VStack gap={3}>
		<TextInput label="Filter products" value={query} onChange={handleChange} hasClear />
		{#if count === 0}
			<Text type="body" color="secondary">No results</Text>
		{:else}
			<List density="compact">
				{#each matches as product (product)}
					<ListItem label={product} />
				{/each}
			</List>
		{/if}
	</VStack>
</Card>
