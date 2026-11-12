<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	/**
	 * Props for the internal own-content announcer. `HTMLAttributes` carries the
	 * rest attributes (including the `class`/`style` a caller passes); `children`
	 * renders inside the div.
	 */
	export interface AnnounceRenderedTextProps extends HTMLAttributes<HTMLDivElement> {
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { useAnnounceRenderedText } from './use-announce-rendered-text.svelte.js';

	/**
	 * Ported from Astryx's `hooks/AnnounceRenderedText.tsx` (0.7.13).
	 *
	 * A `div` whose rendered text is announced once through the shared polite
	 * live region when it appears or changes after the page loaded, and never for
	 * text present when the page first rendered (`spec:AST-086` FR11).
	 *
	 * Internal: imported by path inside the package; not exported from the hooks
	 * barrel or the package entry.
	 */
	const {
		children,
		class: className,
		style: styleProp,
		...rest
	}: AnnounceRenderedTextProps = $props();

	let element = $state<HTMLDivElement>();

	useAnnounceRenderedText(
		() => element,
		() => true,
		() => '',
		{
			skipFirstRender: true
		}
	);
</script>

<div bind:this={element} {...rest} class={className} style={styleProp}>
	{@render children?.()}
</div>
