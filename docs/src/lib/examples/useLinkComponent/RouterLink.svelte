<!--
	The `RouterLink` function component from upstream's
	`templates/blocks/components/Link/useLinkComponentHookUsage.tsx`. Svelte has
	no in-file component declaration, so it is a sibling module; the example
	registry only looks for `<BlockName>.svelte`, so this file is never listed.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getContext } from 'svelte';
	import { NAVIGATE_KEY } from './navigate-context.js';

	interface RouterLinkProps {
		// Optional only so the component satisfies `LinkComponentType`'s
		// `Record<string, unknown>` props shape; `ArticleCard` and the hook's `to`
		// alias always supply it. The `LinkProvider` example's `RouterLink` takes
		// the same shape.
		to?: string;
		href?: string;
		children?: Snippet;
		[key: string]: unknown;
	}

	// `href` is destructured only to keep it off the element — `to` is the
	// destination, as it is upstream where the hook injects the alias.
	const { to = '', href: _href, children, ...props }: RouterLinkProps = $props();

	const navigate = getContext<(to: string) => void>(NAVIGATE_KEY) ?? (() => {});
</script>

<a
	{...props}
	href={to}
	onclick={(event) => {
		event.preventDefault();
		navigate(to);
	}}
>
	{@render children?.()}
</a>
