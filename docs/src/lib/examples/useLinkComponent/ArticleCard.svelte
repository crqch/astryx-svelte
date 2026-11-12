<!--
	The `ArticleCard` function component from upstream's
	`templates/blocks/components/Link/useLinkComponentHookUsage.tsx`. Svelte has
	no in-file component declaration, so it is a sibling module; the example
	registry only looks for `<BlockName>.svelte`, so this file is never listed.
-->
<script lang="ts">
	import { Card, Text, VStack, useLinkComponent } from '@astryx-sv/core';
	import type { LinkComponentType } from '@astryx-sv/core';

	interface Props {
		title: string;
		href: string;
		resolvedBy: string;
		linkAs?: LinkComponentType;
	}

	const { title, href, resolvedBy, linkAs }: Props = $props();

	const resolveLink = useLinkComponent();
	const resolved = $derived(resolveLink(linkAs));
</script>

<Card padding={3}>
	<VStack gap={1}>
		<Text type="body" weight="bold">
			{#if resolved.isNative}
				<a {href}>{title}</a>
			{:else if typeof resolved.component !== 'string'}
				{@const LinkComponent = resolved.component}
				<!-- Upstream's wrapper injects `to={href}` for every non-native
				     component; here the caller does it, as `Link` and `Item` do. -->
				<LinkComponent {href} to={href}>{title}</LinkComponent>
			{/if}
		</Text>
		<Text type="supporting" color="secondary">{resolvedBy}</Text>
	</VStack>
</Card>
