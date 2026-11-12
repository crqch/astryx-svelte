<!--
	Ported from upstream's `templates/blocks/components/Hooks/useTypeaheadHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Both hooks take getters; `useListFocus` returns `attachList` for upstream's
	`listRef`, and its `handleFocus` goes on `onfocusin`. Upstream's `onBlur` is
	the bubbling `focusout` in Svelte, so the reset still runs when focus leaves
	the group.
-->
<script lang="ts">
	import { Button, Text, VStack, useListFocus, useTypeahead } from '@astryx-svelte/core';

	const COUNTRIES = [
		'Belgium',
		'Brazil',
		'Bulgaria',
		'Canada',
		'Chile',
		'Denmark',
		'Éire',
		'Finland'
	];

	let country = $state<string | null>(null);

	const list = useListFocus(() => ({ itemSelector: 'button', hasRovingTabIndex: true }));

	const typeahead = useTypeahead(() => ({
		getItemLabels: () => list.getItems().map((item) => item.textContent),
		onMatch: list.focusItem,
		getCurrentIndex: () => list.getItems().findIndex((item) => item === document.activeElement)
	}));
</script>

<VStack gap={3} hAlign="start">
	<VStack
		{@attach list.attachList}
		role="group"
		aria-label="Country"
		hAlign="start"
		onfocusin={list.handleFocus}
		onfocusout={(event) => {
			if (!(
				event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)
			)) {
				typeahead.reset();
			}
		}}
		onkeydown={(event) => {
			if (typeahead.onKeyDown(event)) {
				event.preventDefault();
			} else {
				list.handleKeyDown(event);
			}
		}}
	>
		{#each COUNTRIES as name (name)}
			<Button
				label={name}
				variant="ghost"
				aria-pressed={country === name}
				onclick={() => (country = name)}
			/>
		{/each}
	</VStack>
	<Text type="supporting">Selected: {country ?? 'none'}</Text>
</VStack>
