<!--
	Ported from upstream's `templates/blocks/components/Timer/TimerFormats.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Stack, Text, Timer } from '@astryx-sv/core';

	const startedAt = Date.now() - 3_753_000;
</script>

<Stack direction="vertical" gap={3}>
	<Stack direction="horizontal" gap={3} vAlign="center">
		<Text type="supporting" color="secondary">Elapsed</Text>
		<Timer startTime={startedAt} type="body" color="primary" />
	</Stack>
	<Stack direction="horizontal" gap={3} vAlign="center">
		<Text type="supporting" color="secondary">Clock</Text>
		<Timer format="clock" startTime={startedAt} type="body" color="primary" />
	</Stack>
</Stack>
