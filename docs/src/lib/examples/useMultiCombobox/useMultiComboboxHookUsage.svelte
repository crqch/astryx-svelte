<!--
	Ported from upstream's `templates/blocks/components/MultiSelector/useMultiComboboxHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Three translations, all this port's standing shapes:
	- `useMultiCombobox` takes its options as a getter; `isImeKeyEvent` receives
	  the native event, not React's synthetic one (so `event.nativeEvent` is just
	  `event`), and the port's event props are lowercase.
	- `useAnnounce({hasReplace: true})` is `useAnnounce()`: this port's signature
	  takes no options.
	- `useId()` is `$props.id()`. The TextInput has no forwarded ref, so its
	  `ref` becomes an attachment, which the component spreads onto the `<input>`
	  — enough to put focus back after a token is removed.
-->
<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import {
		Card,
		HStack,
		Icon,
		Item,
		TextInput,
		Token,
		VStack,
		useMultiCombobox
	} from '@astryx-svelte/core';
	import { useAnnounce } from '@astryx-svelte/core/hooks';
	import { isImeKeyEvent } from '@astryx-svelte/core/utils';

	const LABELS = [
		{ value: 'bug', label: 'Bug' },
		{ value: 'docs', label: 'Documentation' },
		{ value: 'a11y', label: 'Accessibility' },
		{ value: 'perf', label: 'Performance' },
		{ value: 'good-first-issue', label: 'Good first issue' }
	];

	function filterLabels(query: string) {
		const needle = query.trim().toLowerCase();
		return LABELS.filter((item) => item.label.toLowerCase().includes(needle));
	}

	const listboxId = $props.id();
	const announce = useAnnounce();

	let query = $state('');
	let isOpen = $state(false);
	let selected = $state<string[]>(['bug']);
	let inputEl = $state<HTMLInputElement | null>(null);

	const matches = $derived(filterLabels(query));

	function toggle(value: string): void {
		selected = selected.includes(value)
			? selected.filter((item) => item !== value)
			: [...selected, value];
	}

	const combobox = useMultiCombobox(() => ({
		selectableItems: matches,
		isOpen,
		hasSearch: true,
		// With no match there is no option to point at, so the list stays shut.
		onOpen: () => {
			if (matches.length === 0) {
				return false;
			}
			isOpen = true;
		},
		onClose: () => (isOpen = false),
		onToggle: toggle,
		listboxId
	}));

	// `TextInput` forwards its rest props onto the `<input>`, so an attachment
	// reaches the field element even though the component declares no `ref`.
	const focusField: Attachment<HTMLInputElement> = (node) => {
		inputEl = node;
		return () => {
			if (inputEl === node) {
				inputEl = null;
			}
		};
	};
</script>

{#snippet checkIcon()}
	<Icon icon="check" size="sm" />
{/snippet}

<Card width={360} padding={4}>
	<VStack gap={2}>
		<HStack gap={1} wrap="wrap">
			{#each LABELS.filter((item) => selected.includes(item.value)) as item (item.value)}
				<Token
					label={item.label}
					// The removed token's button unmounts, so focus goes back to
					// the field instead of the page.
					onRemove={() => {
						toggle(item.value);
						inputEl?.focus();
					}}
				/>
			{/each}
		</HStack>
		<TextInput
			label="Labels"
			placeholder="Filter labels"
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={isOpen}
			aria-controls={isOpen ? listboxId : undefined}
			aria-activedescendant={combobox.activeDescendantId}
			value={query}
			onChange={(nextQuery) => {
				const previous = query;
				const nextMatches = filterLabels(nextQuery);
				query = nextQuery;
				isOpen = true;
				combobox.setHighlightedIndex(nextMatches.length > 0 ? 0 : -1);
				if (nextQuery.trim() !== previous.trim()) {
					announce(
						nextMatches.length === 0
							? 'No labels match'
							: nextMatches.length === 1
								? '1 label'
								: `${nextMatches.length} labels`
					);
				}
			}}
			onclick={combobox.onTriggerClick}
			onkeydown={(event) => {
				// Keys that compose a Korean, Japanese or Chinese syllable belong
				// to the input method. Home, End, PageUp and PageDown keep their
				// text-field meaning.
				if (isImeKeyEvent(event) || ['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
					return;
				}
				// With no active option, Enter submits a surrounding form.
				if (event.key === 'Enter' && combobox.activeDescendantId == null) {
					return;
				}
				combobox.onKeyDown(event);
			}}
			onblur={() => {
				isOpen = false;
				combobox.setHighlightedIndex(-1);
			}}
			{@attach focusField}
		/>
		{#if isOpen}
			<VStack
				as="ul"
				gap={0}
				id={listboxId}
				role="listbox"
				aria-label="Labels"
				aria-multiselectable
				// Focus stays on the field when an option is pressed.
				onmousedown={(event) => event.preventDefault()}
			>
				{#each matches as item, index (item.value)}
					<Item
						as="li"
						id={combobox.getItemId(index)}
						role="option"
						// Selection is a check mark, so the highlight below stays the
						// only fill on the row and the active option is always visible.
						aria-checked={selected.includes(item.value)}
						density="compact"
						label={item.label}
						endContent={selected.includes(item.value) ? checkIcon : undefined}
						isHighlighted={index === combobox.highlightedIndex}
						onclick={() => toggle(item.value)}
						// Highlight follows pointer movement: a list that opens under
						// a resting pointer keeps the active option the keys set.
						onmousemove={() => combobox.onItemMouseEnter(item, index)}
					/>
				{/each}
			</VStack>
		{/if}
	</VStack>
</Card>
