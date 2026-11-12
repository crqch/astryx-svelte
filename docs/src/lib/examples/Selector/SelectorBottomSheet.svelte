<!--
	Ported from upstream's `templates/blocks/components/Selector/SelectorBottomSheet.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Selector } from '@astryx-sv/core';

	const OPTIONS = [
		{ value: 'design', label: 'Design' },
		{ value: 'engineering', label: 'Engineering' },
		{ value: 'marketing', label: 'Marketing' },
		{ value: 'operations', label: 'Operations' }
	];

	let value = $state<string | undefined>();
</script>

<div style="width: 320px; max-width: 100%;">
	<Selector
		label="Team"
		options={OPTIONS}
		{value}
		onChange={(next: string) => (value = next)}
		placeholder="Choose a team"
		presentation="bottom-sheet"
	/>
</div>
