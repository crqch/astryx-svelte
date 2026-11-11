<!--
	Ported from upstream's `templates/blocks/components/DrawerHeader/DrawerHeaderWithCloseButton.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Button, Drawer, DrawerHeader, Layout, LayoutContent, Text } from '@astryx-svelte/core';

	let isOpen = $state(false);
</script>

<Button label="Open drawer" onclick={() => (isOpen = true)} />
<Drawer bind:isOpen onOpenChange={(open) => (isOpen = open)} label="Details" width={360}>
	<Layout>
		{#snippet header()}
			<DrawerHeader title="Details" onOpenChange={(open) => (isOpen = open)} />
		{/snippet}
		{#snippet content()}
			<LayoutContent>
				<Text type="body">
					Passing onOpenChange renders the close button, which calls it with false.
				</Text>
			</LayoutContent>
		{/snippet}
	</Layout>
</Drawer>
