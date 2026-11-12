<!--
	Ported from upstream's `templates/blocks/components/Drawer/DrawerShowcase.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Button, Drawer, DrawerHeader, Layout, LayoutContent, Text } from '@astryx-sv/core';

	let isOpen = $state(false);
</script>

<Button label="Open drawer" onclick={() => (isOpen = true)} />
<Drawer {isOpen} onOpenChange={(open) => (isOpen = open)} label="Details" width={360}>
	<Layout>
		{#snippet header()}
			<DrawerHeader title="Details" onOpenChange={(open) => (isOpen = open)} />
		{/snippet}
		{#snippet content()}
			<LayoutContent>
				<Text type="body">Close with Escape, the scrim, or the close button.</Text>
			</LayoutContent>
		{/snippet}
	</Layout>
</Drawer>
