<!--
	Ported from upstream's `templates/blocks/components/Link/useLinkifyHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Upstream's `useLinkify` returns `ReactNode[]`; a Svelte hook cannot return
	markup, so it returns structured segments (`text` / `link`) and the caller
	renders the links through `<Link>` — the port's documented shape change for
	this hook. `Comment` is a sibling component because upstream declares it as
	one and a snippet cannot call a hook.
-->
<script lang="ts">
	import { VStack } from '@astryx-svelte/core';
	import Comment from './Comment.svelte';

	const COMMENTS = [
		'See https://example.com/spec or email support@example.com.',
		'Fixed by #123, tracking the regression in #456.',
		'No links here, just a plain note.'
	];
</script>

<VStack gap={3} style="width: 100%; max-width: 360px">
	{#each COMMENTS as comment (comment)}
		<Comment children={comment} />
	{/each}
</VStack>
