<script lang="ts">
	import Markdown from '$lib/components/markdown/markdown.svelte';
	import {
		createMarkdownPluginEntry,
		type MarkdownPluginEntry
	} from '$lib/components/markdown/plugins/protocol.js';

	/**
	 * Upstream's fail-soft SSR markup: a same-name entry with no module
	 * configuration plus a malformed envelope. `createMarkdownPlugin` is not
	 * ported, so the first entry comes from the internal envelope factory; the
	 * second is the same raw frozen object upstream builds.
	 */
	const missingConfig = createMarkdownPluginEntry({ name: 'heading-links', apiVersion: 1 });
	const malformed = Object.freeze({
		name: 'heading-links',
		apiVersion: 2
	}) as unknown as MarkdownPluginEntry;
	const SOURCE = '# Overview\n\n> ## Details';
</script>

<Markdown plugins={[missingConfig, malformed]} children={SOURCE} />
