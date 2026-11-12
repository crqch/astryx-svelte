<script lang="ts">
	import { createRawSnippet } from 'svelte';
	import InfoTip from '$lib/components/info-tip/info-tip.svelte';

	const content = createRawSnippet(() => ({ render: () => '<span>Helpful context</span>' }));

	let button: HTMLButtonElement | null = $state(null);

	export const getButton = () => button;
</script>

<InfoTip bind:ref={button} {content} />
