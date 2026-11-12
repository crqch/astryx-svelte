<!--
	Ported from upstream's `templates/blocks/components/Hooks/useInteractiveRoleHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`useInteractiveRole` keeps the `useSize()` split here: upstream passes the
	options and gets the role in one call, while this port reads the context once
	and returns a resolver, so the decision re-runs wherever the result is read —
	hence the `$derived` in `Tile`. `Tile` is a sibling component because
	upstream declares it as one and a snippet cannot call a hook.
-->
<script lang="ts">
	import { Card, Popover, Text, VStack } from '@astryx-sv/core';
	import Tile from './Tile.svelte';
</script>

<VStack gap={3} hAlign="center" style="width: 100%">
	<Tile href="https://example.com/docs">Renders as a link</Tile>
	<Tile onclick={() => {}}>Renders as a button</Tile>
	<Popover label="Tile details">
		{#snippet content()}
			<Card padding={3}>
				<Text type="body">Opened through the tile's context role</Text>
			</Card>
		{/snippet}
		<Tile>Trigger via context</Tile>
	</Popover>
	<Tile>Plain content</Tile>
</VStack>
