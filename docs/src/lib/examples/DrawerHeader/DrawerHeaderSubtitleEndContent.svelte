<!--
	Ported from upstream's `templates/blocks/components/DrawerHeader/DrawerHeaderSubtitleEndContent.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		Badge,
		Button,
		Drawer,
		DrawerHeader,
		Layout,
		LayoutContent,
		Text
	} from '@astryx-svelte/core';

	let isOpen = $state(false);
</script>

<Button label="Open host details" onclick={() => (isOpen = true)} />
<Drawer {isOpen} onOpenChange={(open) => (isOpen = open)} label="web-prod-04" width={360}>
	<Layout>
		{#snippet header()}
			<DrawerHeader
				title="web-prod-04"
				subtitle="us-east-1"
				onOpenChange={(open) => (isOpen = open)}
			>
				{#snippet endContent()}
					<Badge label="Healthy" variant="success" />
				{/snippet}
			</DrawerHeader>
		{/snippet}
		{#snippet content()}
			<LayoutContent>
				<Text type="body">All 6 instances are passing readiness checks.</Text>
			</LayoutContent>
		{/snippet}
	</Layout>
</Drawer>
