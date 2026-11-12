<!--
	Ported from upstream's `templates/blocks/components/MultiSelector/MultiSelectorBottomSheet.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { MultiSelector } from '@astryx-sv/core';

	const OPTIONS = ['Design', 'Engineering', 'Marketing', 'Operations'];

	let value = $state<string[]>([]);
</script>

<div style="width: 320px; max-width: 100%;">
	<MultiSelector
		label="Teams"
		options={OPTIONS}
		{value}
		onChange={(next) => (value = next)}
		placeholder="Choose teams"
		hasSelectAll
		presentation="bottom-sheet"
	/>
</div>
