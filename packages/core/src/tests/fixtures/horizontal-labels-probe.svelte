<script lang="ts">
	import type { Component } from 'svelte';
	import FormLayout from '$lib/components/form-layout/form-layout.svelte';

	/**
	 * Wraps one component in a `horizontal-labels` `FormLayout`, which upstream's
	 * FR10 cases author inline. A Svelte case cannot put the component under test
	 * inside a layout's markup children, so the member arrives as a component
	 * prop — the shape `slot-probe.svelte` and `layout-divider-provider.svelte`
	 * already use.
	 */
	interface Props {
		// `any` for the reason `slot-probe` gives: a component's props are
		// contravariant, so nothing narrower accepts every component.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		component: Component<any>;
		/** The target's own props. */
		rest?: Record<string | symbol, unknown>;
	}

	const { component: Target, rest = {} }: Props = $props();
</script>

<FormLayout direction="horizontal-labels">
	<Target {...rest} />
</FormLayout>
