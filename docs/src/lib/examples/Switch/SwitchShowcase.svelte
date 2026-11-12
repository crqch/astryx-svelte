<!--
	Ported from upstream's `templates/blocks/components/Switch/SwitchShowcase.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Switch } from '@astryx-sv/core';

	let enabled = $state(true);
</script>

<Switch label="Enable notifications" value={enabled} onChange={(checked) => (enabled = checked)} />
