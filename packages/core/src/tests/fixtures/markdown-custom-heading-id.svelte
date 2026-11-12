<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Upstream's inline heading override from
	 * `headingLinks.test.tsx` — `({children, id}) => <h2 id={id}>{children}</h2>`,
	 * as a component file because `MarkdownComponents.heading` is a Svelte
	 * component. It records the id by applying it, so the test reads rendered
	 * output rather than component internals.
	 */
	// eslint-disable-next-line svelte/no-unused-props -- `level` is part of the contract
	const { children, id }: { level: 1 | 2 | 3 | 4 | 5 | 6; children: Snippet; id?: string } =
		$props();
</script>

<h2 data-custom {id}>{@render children()}</h2>
