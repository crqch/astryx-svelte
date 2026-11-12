<script lang="ts" module>
	import type { AnnounceFn } from '$lib/hooks/use-announce.js';

	export type AnnounceRenderedCase = 'rendered' | 'referenced' | 'fallback' | 'silent';

	export interface AnnounceRenderedCasesProps {
		scenario: AnnounceRenderedCase;
		announceFn?: AnnounceFn;
	}
</script>

<script lang="ts">
	import AnnounceRenderedMessage from './announce-rendered-message.svelte';

	/**
	 * Upstream's four `Message` shapes: rendered text wins, then the
	 * `aria-labelledby` references in ID order, then the fallback; no fallback
	 * and no readable content stays silent.
	 */
	const { scenario, announceFn }: AnnounceRenderedCasesProps = $props();
</script>

{#if scenario === 'rendered'}
	<AnnounceRenderedMessage fallbackText="Loading" aria-labelledby="label" {announceFn}>
		Fetching records
	</AnnounceRenderedMessage>
	<span id="label">Referenced name</span>
{:else if scenario === 'referenced'}
	<AnnounceRenderedMessage
		fallbackText="Loading"
		aria-labelledby="action missing file"
		{announceFn}
	/>
	<span id="file"> files </span>
	<span id="action" hidden>Uploading</span>
{:else if scenario === 'fallback'}
	<AnnounceRenderedMessage fallbackText="Loading" aria-labelledby="missing" {announceFn}>
		<span aria-hidden="true">Decorative ring</span>
		<span hidden>Hidden label</span>
	</AnnounceRenderedMessage>
{:else}
	<AnnounceRenderedMessage aria-labelledby="label" {announceFn} />
	<span id="label">Referenced name</span>
{/if}
