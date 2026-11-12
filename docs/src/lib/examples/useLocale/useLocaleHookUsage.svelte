<!--
	Ported from upstream's `templates/blocks/components/Hooks/useLocaleHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`useLocale()` returns a getter here rather than the locale string, because
	Svelte reads context once at initialisation and a snapshot would freeze the
	summary at the locale it mounted under. `InvoiceSummary` is a sibling
	component for the same reason upstream declares it as one: a Svelte snippet
	cannot call a hook.
-->
<script lang="ts">
	import {
		Card,
		InternationalizationProvider,
		SegmentedControl,
		SegmentedControlItem,
		VStack
	} from '@astryx-svelte/core';
	import InvoiceSummary from './InvoiceSummary.svelte';

	type Locale = 'en' | 'de-DE';

	let locale = $state<Locale>('en');
</script>

<InternationalizationProvider {locale}>
	<Card width={320} padding={4}>
		<VStack gap={3}>
			<SegmentedControl
				label="Language"
				value={locale}
				onChange={(nextLocale) => (locale = nextLocale as Locale)}
				size="sm"
			>
				<SegmentedControlItem value="en" label="English" />
				<SegmentedControlItem value="de-DE" label="German" />
			</SegmentedControl>
			<InvoiceSummary />
		</VStack>
	</Card>
</InternationalizationProvider>
