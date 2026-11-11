<!--
	Ported from upstream's `templates/blocks/components/Selector/SelectorOptionDescriptions.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Upstream imports `LockClosedIcon` and `GlobeAltIcon` from Heroicons; the doc's
	`icons` map names the registry keys `lock` and `globe`, which this port's
	registry does not ship. The two glyphs are inlined as snippets here instead of
	substituting a different semantic icon, so the block keeps upstream's artwork
	and the icon-registry debt still owns the eventual replacement.
-->
<script lang="ts">
	import {
		Button,
		InputGroup,
		Selector,
		SelectorOption,
		Stack,
		type SelectorOptionData
	} from '@astryx-svelte/core';

	// Heroicons 24/outline `lock-closed`.
	const LOCK_PATH =
		'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z';

	// Heroicons 24/outline `globe-alt`.
	const GLOBE_PATH =
		'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418';

	let condensed = $state<string | undefined>('private');
	let full = $state<string | undefined>('private');
	let grouped = $state<string | undefined>('private');
</script>

{#snippet lockIcon()}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		aria-hidden="true"
		width="1em"
		height="1em"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d={LOCK_PATH} />
	</svg>
{/snippet}

{#snippet globeIcon()}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		aria-hidden="true"
		width="1em"
		height="1em"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d={GLOBE_PATH} />
	</svg>
{/snippet}

{#snippet stackedValue(option: SelectorOptionData)}
	<SelectorOption
		icon={option.icon}
		label={option.label ?? option.value}
		description={option.description}
	/>
{/snippet}

<Stack direction="vertical" gap={6}>
	<Selector
		width={320}
		label="Visibility"
		description="Default trigger: one line at the size token."
		options={[
			{
				value: 'private',
				label: 'Private',
				icon: lockIcon,
				description: 'Only members can access this space and its content.'
			},
			{
				value: 'public',
				label: 'Public',
				icon: globeIcon,
				description: 'Anyone at the company can find and join this space.'
			}
		]}
		value={condensed}
		onChange={(next: string | undefined) => (condensed = next)}
	/>
	<Selector
		width={320}
		label="Visibility"
		description="A stacked SelectorOption: the description gets its own line, and the trigger grows by exactly one line."
		options={[
			{
				value: 'private',
				label: 'Private',
				icon: lockIcon,
				description: 'Only members can access this space and its content.'
			},
			{
				value: 'public',
				label: 'Public',
				icon: globeIcon,
				description: 'Anyone at the company can find and join this space.'
			}
		]}
		value={full}
		onChange={(next: string | undefined) => (full = next)}
		renderValue={stackedValue}
	/>
	<InputGroup label="Visibility">
		<Selector
			label="Visibility"
			isLabelHidden
			options={[
				{
					value: 'private',
					label: 'Private',
					icon: lockIcon,
					description: 'Only members can access this space and its content.'
				},
				{
					value: 'public',
					label: 'Public',
					icon: globeIcon,
					description: 'Anyone at the company can find and join this space.'
				}
			]}
			value={grouped}
			onChange={(next: string | undefined) => (grouped = next)}
			renderValue={stackedValue}
		/>
		<Button label="Save" />
	</InputGroup>
</Stack>
