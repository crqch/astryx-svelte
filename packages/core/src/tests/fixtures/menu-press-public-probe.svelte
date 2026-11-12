<script lang="ts" module>
	export interface MenuPressPublicProbeProps {
		onSelect: (label: string) => void;
	}
</script>

<script lang="ts">
	import { useMenuPress } from '$lib/hooks/use-menu-press.svelte.js';

	/**
	 * Upstream's `PublicHarness`: the public hook, with no touch-model option.
	 * An untyped caller passing DropdownMenu's option gets nothing from it.
	 */
	const { onSelect }: MenuPressPublicProbeProps = $props();
	const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

	let menuEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let isOpen = $state(false);

	const press = useMenuPress(() => ({
		menu: () => menuEl,
		trigger: () => triggerEl,
		itemSelector: ITEM_SELECTOR,
		onTriggerPress: () => {
			isOpen = true;
			return true;
		},
		// An untyped caller passing DropdownMenu's own option gets nothing from
		// it: the touch model is not part of the public hook.
		...({ touchModel: 'uikit' } as object)
	}));
</script>

<button bind:this={triggerEl} type="button" {...press.triggerProps}>Open</button>
{#if isOpen}
	<div bind:this={menuEl} role="menu" {...press.menuProps}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div role="menuitem" tabindex={-1} onclick={() => onSelect('A')}>A</div>
	</div>
{/if}
