<!--
	Ported from upstream's `templates/blocks/components/Drawer/DrawerForm.tsx`.
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
		LayoutFooter,
		TextInput,
		VStack
	} from '@astryx-svelte/core';

	let isOpen = $state(false);
	let name = $state('web-prod-04');
	let owner = $state('Platform team');
</script>

<Button label="Edit host" onclick={() => (isOpen = true)} />
<Drawer bind:isOpen onOpenChange={(open) => (isOpen = open)} label="Edit host" purpose="form">
	<Layout>
		{#snippet header()}
			<DrawerHeader title="Edit host" onOpenChange={(open) => (isOpen = open)} />
		{/snippet}
		{#snippet content()}
			<LayoutContent>
				<VStack gap={4}>
					<TextInput label="Name" value={name} onChange={(value) => (name = value)} />
					<TextInput label="Owner" value={owner} onChange={(value) => (owner = value)} />
				</VStack>
			</LayoutContent>
		{/snippet}
		{#snippet footer()}
			<LayoutFooter>
				<HStack gap={2} hAlign="end">
					<Button label="Cancel" variant="secondary" onclick={() => (isOpen = false)} />
					<Button label="Save" variant="primary" onclick={() => (isOpen = false)} />
				</HStack>
			</LayoutFooter>
		{/snippet}
	</Layout>
</Drawer>
