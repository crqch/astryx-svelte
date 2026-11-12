<!--
	Ported from upstream's `templates/blocks/components/Hooks/useListFocusHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Two translations, both this port's standing shapes rather than changes to the
	example: the hook takes its options as a getter and returns `attachList`
	(upstream's `listRef`) as an attachment, and `handleFocus` goes on
	`onfocusin` — React's `onFocus` is the native `focusin` event, which bubbles,
	while Svelte's `onfocus` is `focus` and fires only on the container itself.
-->
<script lang="ts">
	import { Button, Card, VStack, useListFocus } from '@astryx-sv/core';

	const RECENT_FILES = [
		'Q3 roadmap.pdf',
		'Budget 2026.xlsx',
		'Offsite notes.docx',
		'Launch checklist.md'
	];

	const list = useListFocus(() => ({
		itemSelector: 'button',
		orientation: 'vertical',
		wrap: true,
		hasHomeEnd: true,
		hasRovingTabIndex: true
	}));
</script>

<Card width={320} padding={2}>
	<VStack
		{@attach list.attachList}
		role="toolbar"
		aria-label="Recent files"
		aria-orientation="vertical"
		gap={1}
		onkeydown={list.handleKeyDown}
		onfocusin={list.handleFocus}
	>
		{#each RECENT_FILES as name (name)}
			<Button label={name} variant="ghost" />
		{/each}
	</VStack>
</Card>
