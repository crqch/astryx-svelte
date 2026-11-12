<!--
	Ported from upstream's `templates/blocks/components/Link/useLinkComponentHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`useLinkComponent` returns a resolver here (`useLinkComponent()` then
	`resolve(as)`) rather than the resolved component directly, and the resolved
	value carries `isNative` so the caller injects the `to` alias only for a
	custom component — upstream's `createLinkWithTo` does that inside the hook.
	`ArticleCard` and `RouterLink` are sibling components for the same reason
	upstream declares them as functions: Svelte has no in-file component
	declaration.

	Upstream's `NavigateContext` is a module-level React context; here the key is
	the sibling `navigate-context.ts`, so both the block and `RouterLink` can
	read it. Svelte's `setContext` scopes to the whole subtree, so the third card
	below is inside the navigate context too — harmless, because it resolves to a
	native anchor and never reads it.
-->
<script lang="ts">
	import { setContext } from 'svelte';
	import { LinkProvider, Text, VStack } from '@astryx-sv/core';
	import ArticleCard from './ArticleCard.svelte';
	import RouterLink from './RouterLink.svelte';
	import { NAVIGATE_KEY } from './navigate-context.js';

	let route = $state('/');

	setContext(NAVIGATE_KEY, (to: string) => {
		route = to;
	});
</script>

<VStack gap={3}>
	<Text type="body">Router location: {route}</Text>
	<LinkProvider component={RouterLink}>
		<ArticleCard
			title="Getting started"
			href="/articles/getting-started"
			resolvedBy="LinkProvider: the router's link, no page load"
		/>
		<ArticleCard
			title="Style guide (PDF)"
			href="#style-guide"
			resolvedBy={'as="a": a native anchor, even inside the provider'}
			linkAs="a"
		/>
	</LinkProvider>
	<ArticleCard
		title="Release notes"
		href="#release-notes"
		resolvedBy="Outside the provider: the app's LinkProvider, or a native anchor"
	/>
</VStack>
