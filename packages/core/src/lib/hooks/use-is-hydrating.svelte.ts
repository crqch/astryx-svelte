import { onMount } from 'svelte';

/**
 * Ported from Astryx's `hooks/useIsHydrating.ts`.
 *
 * True during the server render and the client render that hydrates server
 * HTML; false after the first mounted render. Upstream reads
 * `useSyncExternalStore`'s server snapshot; Svelte has no equivalent
 * subscription, so `onMount` marks the end of the hydrating render. A
 * client-only mount therefore renders one frame as hydrating, which only a
 * server-markup-sensitive branch can observe.
 *
 * @internal Not re-exported from the hooks barrel, as upstream leaves it.
 */
export function useIsHydrating(): () => boolean {
	let isHydrating = $state(true);

	onMount(() => {
		isHydrating = false;
	});

	return () => isHydrating;
}
