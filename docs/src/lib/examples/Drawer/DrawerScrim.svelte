<!--
	Ported from upstream's `templates/blocks/components/Drawer/DrawerScrim.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import {
		Button,
		Drawer,
		DrawerHeader,
		HStack,
		Layout,
		LayoutContent,
		Text
	} from '@astryx-sv/core';

	let openModal = $state(false);
	let openPanel = $state(false);
</script>

<HStack gap={2}>
	<Button label="Open modal drawer" onclick={() => (openModal = true)} />
	<Button label="Open non-modal drawer" onclick={() => (openPanel = true)} />
</HStack>
<Drawer isOpen={openModal} onOpenChange={(open) => (openModal = open)} label="Edit details">
	<Layout>
		{#snippet header()}
			<DrawerHeader title="Edit details" onOpenChange={(open) => (openModal = open)} />
		{/snippet}
		{#snippet content()}
			<LayoutContent>
				<Text type="body">The scrim blocks the page behind this modal drawer.</Text>
			</LayoutContent>
		{/snippet}
	</Layout>
</Drawer>
<Drawer
	isOpen={openPanel}
	onOpenChange={(open) => (openPanel = open)}
	label="Inspector"
	hasScrim={false}
>
	<Layout>
		{#snippet header()}
			<DrawerHeader title="Inspector" onOpenChange={(open) => (openPanel = open)} />
		{/snippet}
		{#snippet content()}
			<LayoutContent>
				<Text type="body">The page behind this non-modal drawer stays interactive.</Text>
			</LayoutContent>
		{/snippet}
	</Layout>
</Drawer>
