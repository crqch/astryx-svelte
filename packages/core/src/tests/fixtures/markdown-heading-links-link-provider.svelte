<script lang="ts">
	import Markdown from '$lib/components/markdown/markdown.svelte';
	import LinkProvider from '$lib/components/link/link-provider.svelte';
	import type { MarkdownPluginEntry } from '$lib/components/markdown/plugins/protocol.js';
	import ProviderLink from './provider-link.svelte';

	/**
	 * Upstream's `<LinkProvider component={ProviderLink}>` wrapper from
	 * `headingLinks.test.tsx`, as a fixture. The question is whether the heading's
	 * copy control stays an honest `<button>` when the page routes links through
	 * a provider.
	 *
	 * `source` rather than `children`: a component's `children` name is the
	 * default slot in Svelte, not a string prop.
	 */
	const {
		plugins,
		onLinkClick,
		source
	}: {
		plugins: ReadonlyArray<MarkdownPluginEntry>;
		onLinkClick: (href: string, event: MouseEvent) => void | false;
		source: string;
	} = $props();
</script>

<LinkProvider component={ProviderLink}>
	<Markdown {plugins} {onLinkClick} children={source} />
</LinkProvider>
