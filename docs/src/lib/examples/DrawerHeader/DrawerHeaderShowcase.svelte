<!--
	Ported from upstream's `templates/blocks/components/DrawerHeader/DrawerHeaderShowcase.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
	The panel's StyleX frame is an inline style here; see the scroll examples' note.
-->
<script lang="ts">
	import { DrawerHeader, Layout, LayoutContent, Text } from '@astryx-sv/core';

	const panel =
		'width: 360px; max-width: 100%; box-sizing: border-box; background-color: var(--color-background-card); border: 1px solid var(--color-border); border-radius: 0';
	const body =
		'padding: var(--spacing-4); background-color: var(--color-background-muted); border-radius: 0';
</script>

<div style={panel}>
	<Layout height="auto">
		{#snippet header()}
			<DrawerHeader
				title="Host details"
				subtitle="web-prod-04"
				onOpenChange={() => {}}
				hasDivider
			/>
		{/snippet}
		{#snippet content()}
			<LayoutContent>
				<div style={body}>
					<Text type="body" color="secondary">Drawer body content goes here.</Text>
				</div>
			</LayoutContent>
		{/snippet}
	</Layout>
</div>
