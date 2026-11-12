import { untrack } from 'svelte';

/**
 * Ported from Astryx's `utils/useFocusLeavingChange.ts`.
 *
 * The one sequence a disclosure runs so focus leaves content its change takes
 * away (`component:SideNav` AR3, `component:Collapsible` AR4): note the focus
 * before the change touches the DOM, then move it from a post-commit effect of
 * the same change. It pairs with `noteFocusWithin` and `moveFocusLeftBehind`
 * in `focus-return.ts`.
 *
 * `note` receives the value being left and returns what `move` needs, or null
 * when there is nothing to move; `move` receives that and the new value once
 * the change has committed. `note` runs before this commit's DOM update, so it
 * reads refs and the DOM, never the value being changed to. Both callbacks are
 * the caller's latest, because they run from this component's effects.
 */
export function useFocusLeavingChange<V, N>(
	value: () => V,
	note: (previous: V) => N | null,
	move: (noted: N, value: V) => void
): (previous: V) => void {
	let pending: N | null = null;

	$effect(() => {
		const current = value();
		untrack(() => {
			const noted = pending;
			pending = null;
			if (noted != null) {
				move(noted, current);
			}
		});
	});

	return (previous: V) => {
		pending = note(previous);
	};
}
