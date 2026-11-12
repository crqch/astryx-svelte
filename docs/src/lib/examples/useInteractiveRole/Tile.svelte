<!--
	The `Tile` function component from upstream's
	`templates/blocks/components/Hooks/useInteractiveRoleHookUsage.tsx`. Svelte
	has no in-file component declaration, so it is a sibling module; the example
	registry only looks for `<BlockName>.svelte`, so this file is never listed.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Card, Link, Text, useInteractiveRole } from '@astryx-sv/core';

	interface Props {
		href?: string;
		onclick?: () => void;
		children: Snippet;
	}

	const { href, onclick, children }: Props = $props();

	// A polymorphic Tile: the hook alone decides what it renders as — href wins,
	// then onclick, then a trigger context (Popover), then inert.
	const resolveRole = useInteractiveRole();
	const role = $derived(resolveRole({ href, onclick }));
</script>

{#snippet body()}
	<Card padding={3} width={200}>
		<Text type="body">{@render children()}</Text>
	</Card>
{/snippet}

{#if role === 'link'}
	<Link {href}>{@render body()}</Link>
{:else if role === 'button'}
	<button {onclick}>{@render body()}</button>
{:else}
	{@render body()}
{/if}
