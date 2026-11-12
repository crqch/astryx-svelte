<!--
	Ported from upstream's `templates/blocks/components/InternationalizationProvider/useDirectionHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		InternationalizationProvider,
		SegmentedControl,
		SegmentedControlItem,
		VStack
	} from '@astryx-sv/core';
	import Sparkline from './Sparkline.svelte';

	let lang = $state<'en' | 'ar'>('en');
	const isRtl = $derived(lang === 'ar');
</script>

<InternationalizationProvider locale={lang} dir={isRtl ? 'rtl' : 'ltr'}>
	<VStack gap={4} hAlign="center" dir={isRtl ? 'rtl' : 'ltr'} style="width: 100%">
		<SegmentedControl
			label="Locale"
			value={lang}
			onChange={(next) => (lang = next as 'en' | 'ar')}
			size="sm"
		>
			<SegmentedControlItem value="en" label="English (LTR)" />
			<SegmentedControlItem value="ar" label="العربية (RTL)" />
		</SegmentedControl>
		<Sparkline />
	</VStack>
</InternationalizationProvider>
