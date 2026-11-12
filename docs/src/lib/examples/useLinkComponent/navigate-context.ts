/**
 * Upstream's `NavigateContext`, which its `RouterLink` reads with React's
 * `use()`. Svelte's context is keyed by an arbitrary value, so the key lives in
 * its own module and both the block and `RouterLink.svelte` import it.
 */
export const NAVIGATE_KEY = Symbol('navigate');
