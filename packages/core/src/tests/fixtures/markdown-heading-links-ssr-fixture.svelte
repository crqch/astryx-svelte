<script lang="ts">
	import Markdown from '$lib/components/markdown/markdown.svelte';
	import { createMarkdownHeadingLinks } from '$lib/components/markdown/plugins/heading-links.js';

	/**
	 * Upstream's two-article markup from `headingLinks.ssr.test.tsx`. Prefixes
	 * arrive as JSON props so the same fixture can be server-rendered through the
	 * dev server and hydrated from the same source in the client project.
	 */
	const {
		prefixA = 'article-a',
		prefixB = 'article-b'
	}: {
		prefixA?: string;
		prefixB?: string;
	} = $props();

	const SOURCE = '# Overview\n\n> ## Details';
</script>

<Markdown
	id="article-a"
	plugins={[createMarkdownHeadingLinks({ headingIdPrefix: prefixA })]}
	children={SOURCE}
/>
<Markdown
	id="article-b"
	plugins={[createMarkdownHeadingLinks({ headingIdPrefix: prefixB })]}
	children={SOURCE}
/>
