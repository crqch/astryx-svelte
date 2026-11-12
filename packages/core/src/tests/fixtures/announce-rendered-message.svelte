<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { AnnounceFn } from '$lib/hooks/use-announce.js';

	export interface AnnounceRenderedMessageProps extends HTMLAttributes<HTMLDivElement> {
		fallbackText?: string;
		announceFn?: AnnounceFn;
		children?: Snippet;
	}
</script>

<script lang="ts">
	import { useAnnounceRenderedText } from '$lib/hooks/use-announce-rendered-text.svelte.js';

	const { fallbackText, announceFn, children, ...rest }: AnnounceRenderedMessageProps = $props();
	let element = $state<HTMLDivElement>();
	useAnnounceRenderedText(
		() => element,
		() => true,
		() => '',
		{
			// svelte-ignore state_referenced_locally
			fallbackText,
			// svelte-ignore state_referenced_locally
			announce: announceFn
		}
	);
</script>

<div bind:this={element} {...rest}>
	{@render children?.()}
</div>
