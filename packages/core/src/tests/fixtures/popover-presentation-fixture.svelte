<script lang="ts">
	import Popover, {
		type PopoverPresentation,
		type PopoverTriggerRenderProps
	} from '$lib/components/popover/popover.svelte';
	import type { StyleArg } from '$lib/internal/sx.js';

	/**
	 * Upstream's `PopoverPresentation.test.tsx` `Filters` tree — `<Popover
	 * label="Filters" content={<button>Apply</button>}>` — plus the trigger and
	 * content shapes its cases exercise. Both `children` and `content` are
	 * snippets here, so neither can be written inline in a `render()` props
	 * object.
	 */
	interface Props {
		presentation?: PopoverPresentation;
		/** `null` omits the label, so the sheet must name itself from the trigger. */
		label?: string | null;
		onOpenChange?: (isOpen: boolean) => void;
		hasLightDismiss?: boolean;
		hasEscapeDismiss?: boolean;
		hasCloseButton?: boolean;
		role?: 'dialog' | 'none';
		triggerMode?: 'children' | 'render';
		triggerLabel?: string;
		contentVariant?: 'button' | 'text' | 'checkbox';
		contentText?: string;
		className?: string;
		style?: string;
		xstyle?: StyleArg;
		'data-testid'?: string;
	}

	const {
		presentation,
		label: labelProp = 'Filters',
		onOpenChange,
		hasLightDismiss,
		hasEscapeDismiss,
		hasCloseButton,
		role,
		triggerMode = 'children',
		triggerLabel = 'Filter',
		contentVariant = 'button',
		contentText = 'Apply',
		className,
		style,
		xstyle,
		'data-testid': testId
	}: Props = $props();

	const label = $derived(labelProp === null ? undefined : labelProp);
</script>

{#snippet content()}
	{#if contentVariant === 'checkbox'}
		<input type="checkbox" aria-label="Archived" />
	{:else if contentVariant === 'text'}
		<p>{contentText}</p>
	{:else}
		<button type="button">{contentText}</button>
	{/if}
{/snippet}

{#snippet trigger(props: PopoverTriggerRenderProps)}
	<button
		type="button"
		{@attach props.ref}
		onclick={props.onClick}
		aria-haspopup={props['aria-haspopup']}
		aria-expanded={props['aria-expanded']}
		aria-controls={props['aria-controls']}
	>
		{triggerLabel}
	</button>
{/snippet}

<Popover
	{presentation}
	{label}
	{onOpenChange}
	{hasLightDismiss}
	{hasEscapeDismiss}
	{hasCloseButton}
	{role}
	{content}
	trigger={triggerMode === 'render' ? trigger : undefined}
	class={className}
	{style}
	{xstyle}
	data-testid={testId}
>
	{#if triggerMode !== 'render'}
		<button type="button">{triggerLabel}</button>
	{/if}
</Popover>
