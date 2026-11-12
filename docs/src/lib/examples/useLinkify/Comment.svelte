<!--
	The `Comment` function component from upstream's
	`templates/blocks/components/Link/useLinkifyHookUsage.tsx`. Svelte has no
	in-file component declaration, so it is a sibling module; the example
	registry only looks for `<BlockName>.svelte`, so this file is never listed.
-->
<script lang="ts">
	import { Link, Text, useLinkify } from '@astryx-svelte/core';
	import type { LinkifyPattern } from '@astryx-svelte/core';

	interface Props {
		children: string;
	}

	const { children: text }: Props = $props();

	// Issue references like #123 link into the tracker; the capture group maps
	// onto its URL scheme, showing the patterns option.
	const ISSUE_PATTERN: LinkifyPattern = {
		pattern: /#(\d+)/g,
		href: (match) => `https://example.com/issues/${match[1]}`
	};

	const segments = $derived(useLinkify(text, { patterns: [ISSUE_PATTERN] }));
</script>

<Text type="body" color="secondary">
	{#each segments as segment, i (i)}
		{#if segment.type === 'link'}
			<Link href={segment.href} isExternalLink={segment.isExternal}>{segment.label}</Link>
		{:else}
			{segment.text}
		{/if}
	{/each}
</Text>
