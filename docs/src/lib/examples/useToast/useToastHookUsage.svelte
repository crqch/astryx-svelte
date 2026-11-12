<!--
	Ported from upstream's `templates/blocks/components/Toast/useToastHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	Upstream passes the Undo `<Button>` as `endContent` inside the options object.
	A toast is shown imperatively, so the one markup slot has to travel as a
	`{#snippet}` from this component's template; `save` receives it as an argument
	because a snippet declared in markup is not in the instance script's scope.
	The snippet's closure state replaces upstream's per-call closure variables.
-->
<script lang="ts">
	import { Button, Card, Switch, TextInput, VStack, useToast } from '@astryx-svelte/core';
	import type { Snippet } from 'svelte';

	const toast = useToast();

	let name = $state('Ada Lovelace');
	let savedName = $state('Ada Lovelace');
	let undoName = $state('Ada Lovelace');
	let isSaveFailing = $state(false);
	let undoTarget = $state('Ada Lovelace');
	let dismissSaveToast: (() => void) | null = null;

	function save(endContent: Snippet) {
		if (isSaveFailing) {
			toast({
				type: 'error',
				body: 'Could not save settings',
				uniqueID: 'settings-save'
			});
			return;
		}

		// Saving an unchanged name keeps the earlier undo target.
		const nextUndoName = name === savedName ? undoName : savedName;
		undoName = nextUndoName;
		undoTarget = nextUndoName;
		savedName = name;

		dismissSaveToast = toast({
			body: 'Settings saved',
			// A repeated Save replaces this toast instead of stacking another.
			uniqueID: 'settings-save',
			endContent
		});
	}
</script>

{#snippet undoButton()}
	<Button
		label="Undo"
		variant="ghost"
		size="sm"
		onclick={() => {
			name = undoTarget;
			savedName = undoTarget;
			dismissSaveToast?.();
		}}
	/>
{/snippet}

<Card width={360} padding={4}>
	<VStack gap={3}>
		<TextInput label="Display name" value={name} onChange={(next) => (name = next)} />
		<Switch
			label="Simulate a failed save"
			value={isSaveFailing}
			onChange={(next) => (isSaveFailing = next)}
		/>
		<Button label="Save" variant="primary" onclick={() => save(undoButton)} />
	</VStack>
</Card>
