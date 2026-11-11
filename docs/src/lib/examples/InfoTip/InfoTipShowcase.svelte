<!--
	Ported from upstream's `templates/blocks/components/InfoTip/InfoTipShowcase.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { HStack, InfoTip, Text, VStack } from '@astryx-svelte/core';
</script>

<VStack gap={1}>
	<HStack gap={1} align="center">
		<Text type="label" color="secondary">Rolling average</Text>
		<InfoTip content="30-day rolling average, recomputed nightly." label="About this metric" />
	</HStack>
	<Text type="display-3">1,284</Text>
</VStack>
