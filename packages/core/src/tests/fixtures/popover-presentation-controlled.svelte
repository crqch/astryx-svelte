<script lang="ts">
	import Popover, { type PopoverPresentation } from '$lib/components/popover/popover.svelte';

	/**
	 * Upstream's controlled `PopoverPresentation.test.tsx` trees: an outside
	 * button opens the popover, and the popover's own trigger asks to close it.
	 * The state lives here because upstream's does, in the test component.
	 */
	interface Props {
		presentation?: PopoverPresentation;
		initialOpen?: boolean;
		hasLightDismiss?: boolean;
		hasEscapeDismiss?: boolean;
		onChange?: (isOpen: boolean) => void;
	}

	let {
		presentation = 'adaptive',
		initialOpen = false,
		hasLightDismiss,
		hasEscapeDismiss,
		onChange
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	let isOpen = $state(initialOpen);

	function handleOpenChange(next: boolean): void {
		isOpen = next;
		onChange?.(next);
	}
</script>

{#snippet content()}
	<button type="button">Apply</button>
{/snippet}

<button type="button" onclick={() => (isOpen = true)}>Open from outside</button>

<Popover
	label="Filters"
	{presentation}
	{isOpen}
	onOpenChange={handleOpenChange}
	{hasLightDismiss}
	{hasEscapeDismiss}
	{content}
>
	<button type="button">Filter</button>
</Popover>
