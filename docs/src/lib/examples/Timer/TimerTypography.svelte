<!--
	Ported from upstream's `templates/blocks/components/Timer/TimerTypography.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Stack, Text, Timer } from '@astryx-svelte/core';

	const startedAt = Date.now() - 128_000;
</script>

<Stack direction="vertical" gap={3}>
	<Text type="supporting" color="secondary">Default</Text>
	<Timer startTime={startedAt} />
	<Text type="supporting" color="secondary">Emphasized</Text>
	<Timer startTime={startedAt} type="body" size="xl" color="primary" weight="semibold" />
</Stack>
