<!--
	Ported from upstream's `templates/blocks/components/Hooks/useInputStatusIconHookUsage.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.

	`useInputStatusIcon` returns the affordance's data rather than upstream's
	`statusIcon` node — a Svelte hook cannot return markup — so `<InputStatusIcon>`
	renders it. The hook's `id` is required here because `useTooltip` cannot mint
	an SSR-stable one from inside a hook. `CouponField` is a sibling component
	because upstream declares it as one and a snippet cannot call a hook.
-->
<script lang="ts">
	import { Card, SegmentedControl, SegmentedControlItem, Text, VStack } from '@astryx-sv/core';
	import type { FieldStatusVariant } from '@astryx-sv/core';
	import CouponField from './CouponField.svelte';

	const VALID_CODE = 'SAVE20';

	let statusVariant = $state<FieldStatusVariant>('attached');
</script>

<Card width={360} padding={4}>
	<VStack gap={3}>
		<SegmentedControl
			label="Status variant"
			value={statusVariant}
			onChange={(next) => (statusVariant = next as FieldStatusVariant)}
			size="sm"
		>
			<SegmentedControlItem value="attached" label="Attached" />
			<SegmentedControlItem value="detached" label="Detached" />
			<SegmentedControlItem value="tooltip" label="Tooltip" />
		</SegmentedControl>
		<CouponField {statusVariant} />
		<Text type="supporting">Type {VALID_CODE} to see the success status.</Text>
	</VStack>
</Card>
