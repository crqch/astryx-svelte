<script lang="ts">
	import BottomSheet from '$lib/components/bottom-sheet/bottom-sheet.svelte';

	/**
	 * The three controlled hosts from upstream's reduced-motion dismissal
	 * cases: a sheet with a Close control, the same with a page-level Open
	 * control so it can be reopened, and a sheet that refuses implicit closes
	 * until its own Unlock control is pressed.
	 */
	let {
		variant = 'controlled'
	}: {
		variant?: 'controlled' | 'reopenable' | 'guarded';
	} = $props();

	let isOpen = $state(true);
	let isGuarded = $state(true);

	function handleOpenChange(next: boolean): void {
		if (variant === 'guarded' && !next && isGuarded) {
			return;
		}
		isOpen = next;
	}
</script>

{#if variant === 'reopenable'}
	<button type="button" onclick={() => (isOpen = true)}>Open</button>
{/if}

<BottomSheet {isOpen} onOpenChange={handleOpenChange} label="Filters">
	{#if variant === 'guarded'}
		<button type="button" onclick={() => (isGuarded = false)}>Unlock</button>
	{/if}
	<button type="button" onclick={() => (isOpen = false)}>Close</button>
</BottomSheet>
