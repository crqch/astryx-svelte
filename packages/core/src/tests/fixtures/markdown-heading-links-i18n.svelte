<script lang="ts">
	import Markdown from '$lib/components/markdown/markdown.svelte';
	import InternationalizationProvider from '$lib/i18n/internationalization-provider.svelte';
	import type { MarkdownPluginEntry } from '$lib/components/markdown/plugins/protocol.js';

	/**
	 * Upstream's inline `<InternationalizationProvider>{children}</…>` wrapper
	 * from `headingLinks.test.tsx`, as a fixture — Svelte cannot author component
	 * children inline in a `.ts` test file, and the provider needs a real subtree.
	 *
	 * `source` rather than `children`: a component's `children` name is the
	 * default slot in Svelte, not a string prop, so a Markdown source passed under
	 * that name arrives as a snippet.
	 */
	const {
		plugins,
		source
	}: {
		plugins: ReadonlyArray<MarkdownPluginEntry>;
		source: string;
	} = $props();
</script>

<InternationalizationProvider
	locale="fr"
	overrides={{
		fr: {
			'@astryx.markdownHeadingLinks.copied': 'Lien copié',
			'@astryx.markdownHeadingLinks.copy': 'Copier le lien vers {heading}'
		}
	}}
>
	<Markdown {plugins} children={source} />
</InternationalizationProvider>
