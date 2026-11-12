<!--
	Ported from upstream's `templates/blocks/components/Drawer/DrawerStart.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Button, Drawer, DrawerHeader, Layout, LayoutContent, Text } from '@astryx-sv/core';

	let isOpen = $state(false);
</script>

<Button label="Open start drawer" onclick={() => (isOpen = true)} />
<Drawer {isOpen} onOpenChange={(open) => (isOpen = open)} label="Navigation" side="start">
	<Layout>
		{#snippet header()}
			<DrawerHeader title="Navigation" onOpenChange={(open) => (isOpen = open)} />
		{/snippet}
		{#snippet content()}
			<LayoutContent>
				<Text type="body">The start edge follows the page's writing direction.</Text>
			</LayoutContent>
		{/snippet}
	</Layout>
</Drawer>
