<!--
	Ported from upstream's `templates/blocks/components/Popover/PopoverBottomSheetAlternative.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	The three actions use Heroicons' outline glyphs. This port's icon registry does
	not ship user/tag/calendar, so the exact upstream path data is rendered here
	until the icon-registry expansion retires that debt. The header inset matches
	the unchanged spacious ListItem inset so the title and description align with
	the action icons.
-->
<script lang="ts">
	import {
		BottomSheet,
		Button,
		Heading,
		List,
		ListItem,
		Section,
		Text,
		VStack
	} from '@astryx-svelte/core';

	const PROJECT_ACTIONS = [
		['user', 'Assign owner', 'Route follow-up to a teammate.'],
		['tag', 'Add label', 'Group this item with related work.'],
		['calendar', 'Set due date', 'Pick a reminder for review.']
	] as const;

	let isOpen = $state(false);
</script>

{#snippet projectIcon(kind: 'user' | 'tag' | 'calendar')}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		width="1.25rem"
		height="1.25rem"
		aria-hidden="true"
		class="project-action-icon"
	>
		{#if kind === 'user'}
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
			/>
		{:else if kind === 'tag'}
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
			/>
			<path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
		{:else}
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
			/>
		{/if}
	</svg>
{/snippet}

<Button label="Open project actions" onclick={() => (isOpen = true)} />

<BottomSheet {isOpen} onOpenChange={(next) => (isOpen = next)} label="Project actions" height="hug">
	<Section paddingBlock={4} paddingInline={1}>
		<VStack gap={3}>
			<VStack gap={1} class="project-header">
				<Heading level={3}>Project actions</Heading>
				<Text type="supporting" color="secondary">
					Use this modal touch surface when the task should move away from its trigger and stay
					close to the bottom edge.
				</Text>
			</VStack>
			<List density="spacious">
				{#each PROJECT_ACTIONS as [kind, label, description] (label)}
					<ListItem {label} {description} onclick={() => (isOpen = false)}>
						{#snippet startContent()}
							{@render projectIcon(kind)}
						{/snippet}
					</ListItem>
				{/each}
			</List>
		</VStack>
	</Section>
</BottomSheet>

<style>
	.project-header {
		margin-inline-start: var(--spacing-3);
	}

	.project-action-icon {
		color: var(--color-icon-secondary);
	}
</style>
