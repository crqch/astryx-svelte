<script lang="ts" module>
	export interface MenuPressProbeProps {
		onSelect?: (label: string) => void;
		onDismiss?: () => void;
		onOpenChange?: (isOpen: boolean) => void;
		hitTest?: (x: number, y: number) => Element | null;
		getScroller?: () => HTMLElement | null;
		onHighlight?: (row: HTMLElement | null) => void;
		touchModel?: 'pointer' | 'uikit';
		longPressDelayMs?: number;
		isScrollable?: boolean;
	}
</script>

<script lang="ts">
	import { useDropdownMenuPress } from '$lib/hooks/use-menu-press.svelte.js';

	/**
	 * Upstream `hooks/useMenuPress.test.tsx`'s `Harness`, as a component.
	 *
	 * The menu stays rendered while closed, as upstream's does: every case drives
	 * presses on its rows without opening it first. `isScrollable` gives the
	 * autoscroll case a real scroll box — Chromium refuses to move `scrollTop`
	 * on an element that does not overflow, where jsdom accepts it.
	 */
	const {
		onSelect,
		onDismiss,
		onOpenChange,
		hitTest,
		getScroller,
		onHighlight,
		touchModel,
		longPressDelayMs,
		isScrollable = false
	}: MenuPressProbeProps = $props();

	const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

	let menuEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let isOpen = $state(false);

	function open(next: boolean): void {
		isOpen = next;
		onOpenChange?.(next);
	}

	// DropdownMenu's own entry, so the harness can also drive its touch model;
	// without `touchModel` it behaves as the public hook.
	const press = useDropdownMenuPress(() => ({
		menu: () => menuEl,
		trigger: () => triggerEl,
		itemSelector: ITEM_SELECTOR,
		onTriggerPress: () => {
			if (isOpen) {
				open(false);
				return false;
			}
			open(true);
			return true;
		},
		onDismiss,
		hitTest,
		getScroller,
		onHighlight,
		touchModel,
		longPressDelayMs
	}));

	export function isTriggerClickFromPress(): boolean {
		return press.isTriggerClickFromPress();
	}

	export function cancel(): void {
		press.cancel();
	}
</script>

<button
	bind:this={triggerEl}
	type="button"
	{...press.triggerProps}
	aria-expanded={isOpen}
	onclick={() => {
		if (press.isTriggerClickFromPress()) return;
		open(!isOpen);
	}}
>
	Open
</button>
<div
	bind:this={menuEl}
	role="menu"
	tabindex={-1}
	{...press.menuProps}
	style={isScrollable ? 'max-height: 20px; overflow-y: auto' : undefined}
>
	{#each ['A', 'B', 'C'] as label (label)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div role="menuitem" tabindex={-1} onclick={() => onSelect?.(label)}>{label}</div>
	{/each}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div role="menuitem" aria-disabled="true" onclick={() => onSelect?.('D')}>D (disabled)</div>
	<div role="separator" data-testid="divider"></div>
</div>
<button type="button" data-testid="outside">Outside</button>
