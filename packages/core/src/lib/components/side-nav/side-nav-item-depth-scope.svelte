<script lang="ts" module>
	import type { Snippet } from 'svelte';

	/**
	 * Upstream's `SideNavItemDepthContext value={depth}` provider. Svelte's
	 * `setContext` applies to a component's whole subtree and is only valid
	 * during initialisation, so a provider component is the counterpart of
	 * React's wrapping context provider — it renders no DOM of its own.
	 */
	export interface SideNavItemDepthScopeProps {
		depth: number;
		children: Snippet;
	}
</script>

<script lang="ts">
	import { SideNavItemDepthContext } from './side-nav-item-depth-context.svelte.js';

	const { depth, children }: SideNavItemDepthScopeProps = $props();

	// A getter, so a depth change reaches descendants rather than freezing the
	// first value — the same reason the collapse context stores a getter.
	SideNavItemDepthContext.set({
		get depth() {
			return depth;
		}
	});
</script>

{@render children()}
