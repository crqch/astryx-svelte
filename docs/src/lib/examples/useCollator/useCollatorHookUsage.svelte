<!--
	Ported from upstream's `templates/blocks/components/Hooks/useCollatorHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		Card,
		InternationalizationProvider,
		SegmentedControl,
		SegmentedControlItem,
		VStack
	} from '@astryx-sv/core';
	import PeopleList from './PeopleList.svelte';

	type Locale = 'en' | 'sv-SE';

	let locale = $state<Locale>('en');
</script>

<InternationalizationProvider {locale}>
	<Card width={320} padding={4}>
		<VStack gap={3}>
			<SegmentedControl
				label="Sort order"
				value={locale}
				onChange={(nextLocale) => (locale = nextLocale as Locale)}
				size="sm"
			>
				<SegmentedControlItem value="en" label="English" />
				<SegmentedControlItem value="sv-SE" label="Swedish" />
			</SegmentedControl>
			<PeopleList />
		</VStack>
	</Card>
</InternationalizationProvider>
