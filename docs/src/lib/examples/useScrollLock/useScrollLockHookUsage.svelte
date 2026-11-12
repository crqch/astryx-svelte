<!--
	Ported from upstream's `templates/blocks/components/Hooks/useScrollLockHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`useScrollLock` takes a getter here, `useFocusTrap` returns an attachment
	instead of a ref, and `onCancel`/`onKeyDown`/`onClick` are the native
	lowercase events. The menu's local `stylex.create` rules are one `style`
	attribute, since a `.svelte` file may not import StyleX.
-->
<script lang="ts">
	import { Button, Link, VStack, useFocusTrap, useScrollLock } from '@astryx-svelte/core';

	const MENU_ITEMS = ['Products', 'Pricing', 'Customers', 'Support'];

	let isOpen = $state(false);
	let dialogEl: HTMLDialogElement | null = null;

	useScrollLock(() => isOpen);

	const trap = useFocusTrap(() => ({ isActive: isOpen, onEscape: close }));

	// The dialog leaves the top layer before the state change, so the page is
	// no longer inert when the focus trap hands focus back to Menu.
	function close() {
		dialogEl?.close();
		isOpen = false;
	}

	$effect(() => {
		if (isOpen && dialogEl != null && !dialogEl.open) {
			dialogEl.showModal();
			trap.focusFirst();
		}
	});
</script>

<Button label="Menu" onclick={() => (isOpen = true)} />
<dialog
	bind:this={dialogEl}
	{@attach trap.attachContainer}
	aria-label="Menu"
	oncancel={(event) => {
		event.preventDefault();
		close();
	}}
	style="width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; border-width: 0; overflow-y: auto; padding: var(--spacing-4); color: var(--color-text-primary); background-color: var(--color-background-surface)"
>
	<nav aria-label="Site menu">
		<VStack gap={4} hAlign="start">
			<Button label="Close menu" variant="secondary" onclick={close} />
			{#each MENU_ITEMS as item (item)}
				<Link href={`#menu-${item.toLowerCase()}`} onclick={close}>{item}</Link>
			{/each}
		</VStack>
	</nav>
</dialog>
