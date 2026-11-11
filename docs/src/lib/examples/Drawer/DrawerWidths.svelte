<!--
	Ported from upstream's `templates/blocks/components/Drawer/DrawerWidths.tsx`.
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
	} from '@astryx-svelte/core';

	let isOpen = $state(false);
	let width = $state<number | string>(320);

	function openAtWidth(value: number | string) {
		width = value;
		isOpen = true;
	}
</script>

<HStack gap={2}>
	<Button label="320px" onclick={() => openAtWidth(320)} />
	<Button label="32rem" onclick={() => openAtWidth('32rem')} />
	<Button label="50%" onclick={() => openAtWidth('50%')} />
</HStack>
<Drawer {isOpen} onOpenChange={(open) => (isOpen = open)} label="Width budget" {width}>
	<Layout>
		{#snippet header()}
			<DrawerHeader title="Width budget" onOpenChange={(open) => (isOpen = open)} />
		{/snippet}
		{#snippet content()}
			<LayoutContent>
				<Text type="body">Width: {typeof width === 'number' ? `${width}px` : width}</Text>
			</LayoutContent>
		{/snippet}
	</Layout>
</Drawer>
