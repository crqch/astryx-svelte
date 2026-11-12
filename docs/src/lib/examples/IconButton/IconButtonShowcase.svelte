<!--
	Ported from upstream's `templates/blocks/components/IconButton/IconButtonShowcase.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Icon, IconButton } from '@astryx-sv/core';
</script>

<IconButton label="Settings">
	{#snippet icon()}<Icon icon="wrench" color="inherit" />{/snippet}
</IconButton>
