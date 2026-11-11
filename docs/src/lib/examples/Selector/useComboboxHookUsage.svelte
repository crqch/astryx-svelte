<!--
	Ported from upstream's `templates/blocks/components/Selector/useComboboxHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Two translations, both this port's standing shapes rather than changes to the
	example: React's event props become Svelte's lowercase attributes
	(`onKeyDown` → `onkeydown`), and `useAnnounce({hasReplace: true})` is
	`useAnnounce()` — this port's signature takes no options.
-->
<script lang="ts">
	import { Card, Item, Text, TextInput, VStack, useCombobox } from '@astryx-svelte/core';
	import { useAnnounce } from '@astryx-svelte/core/hooks';

	type Teammate = { value: string; label: string; disabled?: boolean };

	const TEAMMATES: Teammate[] = [
		{ value: 'ada', label: 'Ada Lovelace' },
		{ value: 'alan', label: 'Alan Turing' },
		{ value: 'grace', label: 'Grace Hopper (away)', disabled: true },
		{ value: 'katherine', label: 'Katherine Johnson' },
		{ value: 'margaret', label: 'Margaret Hamilton' }
	];

	function matching(query: string): Teammate[] {
		const needle = query.trim().toLowerCase();
		return TEAMMATES.filter((teammate) => teammate.label.toLowerCase().includes(needle));
	}

	const listboxId = $props.id();
	const announce = useAnnounce();

	let query = $state('');
	let isOpen = $state(false);
	let assignee = $state<string>();

	const options = $derived(matching(query));

	const combobox = useCombobox(() => ({
		selectableItems: options,
		isOpen,
		onOpen: () => (isOpen = true),
		onClose: () => (isOpen = false),
		onSelect: (value: string) => {
			assignee = TEAMMATES.find((teammate) => teammate.value === value)?.label;
			query = '';
		},
		listboxId
	}));
</script>

<Card width={320} padding={4}>
	<VStack gap={2}>
		<TextInput
			label="Assign to"
			value={query}
			onChange={(next) => {
				const previous = query;
				const matches = matching(next);
				query = next;
				isOpen = true;
				// A new query makes its first enabled match active, so Enter picks it.
				combobox.setHighlightedIndex(matches.findIndex((teammate) => !teammate.disabled));
				if (next.trim() !== previous.trim()) {
					announce(
						matches.length === 0
							? 'No one matches'
							: matches.length === 1
								? '1 teammate'
								: `${matches.length} teammates`
					);
				}
			}}
			onblur={() => {
				isOpen = false;
				combobox.setHighlightedIndex(-1);
			}}
			{...combobox.getFieldProps()}
		/>
		{#if isOpen && options.length > 0}
			<VStack as="ul" gap={0} aria-label="Teammates" {...combobox.getListboxProps()}>
				{#each options as teammate, index (teammate.value)}
					<Item
						as="li"
						density="compact"
						label={teammate.label}
						isHighlighted={index === combobox.highlightedIndex}
						isSelected={index === combobox.highlightedIndex}
						isDisabled={teammate.disabled}
						{...combobox.getOptionProps(index)}
					/>
				{/each}
			</VStack>
		{:else if isOpen}
			<Text type="supporting">No one matches</Text>
		{/if}
		<Text type="supporting">
			{assignee == null ? 'Unassigned' : `Assigned to ${assignee}`}
		</Text>
	</VStack>
</Card>
