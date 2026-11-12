<!--
	Ported from upstream's `templates/blocks/components/Stepper/StepperWidthResponsiveCollapse.tsx`.
	Transcribed, not re-authored: the parity rule covers example content too.
-->
<script lang="ts">
	import { Step, Stepper } from '@astryx-sv/core';

	let active = $state(1);
</script>

<div style="width: 320px">
	<Stepper
		activeStep={active}
		orientation="horizontal"
		onStepClick={(index) => (active = index)}
		horizontalOptions={{
			minimumStepWidth: 112,
			collapsedVariant: 'withLabelAndControls'
		}}
	>
		<Step step={0} label="Cart" />
		<Step step={1} label="Shipping" description="Where it goes" />
		<Step step={2} label="Delivery" />
		<Step step={3} label="Payment" />
	</Stepper>
</div>
