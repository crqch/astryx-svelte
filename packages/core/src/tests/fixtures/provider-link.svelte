<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Upstream's `ProviderLink` from `headingLinks.test.tsx` — a provider-routed
	 * anchor that tags itself with `data-provider-link`.
	 *
	 * `children` is optional so the component satisfies `LinkComponentType`
	 * (`Component<Record<string, unknown>>`): a required prop would make its
	 * parameter type narrower than the provider contract.
	 */
	const { children, ...rest }: { children?: Snippet; [key: string]: unknown } = $props();
</script>

<a data-provider-link {...rest}
	>{#if children}{@render children()}{/if}</a
>
