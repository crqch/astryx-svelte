<script lang="ts">
	import Dialog from '$lib/components/dialog/dialog.svelte';
	import { useAnnounce } from '$lib/hooks/use-announce.js';
	import AnnounceOwner from './announce-owner.svelte';

	/**
	 * Upstream's `Opener`: the component renders a Dialog but announces from
	 * above it, so its own messages take the page route and only the content's
	 * messages route into the dialog.
	 */
	const announce = useAnnounce();
</script>

<button type="button" onclick={() => announce('From above')}>Above</button>
<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
	<AnnounceOwner message="From inside" label="Inside" />
</Dialog>
