import { untrack } from 'svelte';

/**
 * Ported from Astryx's `motion/LayoutChangeSnapshot.tsx`.
 *
 * Upstream is a class component whose `getSnapshotBeforeUpdate` React runs in
 * the commit, after render and before any DOM mutation of that commit. It is
 * how a component that takes an `animatedLayout` handle measures each change
 * before it lands (`spec:AST-105` FR1), whatever caused it: a click, an
 * owner-set prop, or a group's value.
 *
 * Svelte has no class-component counterpart, and a child component's
 * `$effect.pre` is not ordered against its parent's DOM patch: a pre effect
 * runs before the DOM update of the component whose `<script>` created it. A
 * separate `<LayoutChangeSnapshot>` element would therefore measure after the
 * sibling markup it exists to measure. This is a rune hook instead, called by
 * the component that owns the value and the DOM it moves, so its
 * `$effect.pre` is created before that component's template effect and runs
 * while the pre-change layout is still in the DOM.
 *
 * Only a commit that changes `value` calls `onBeforeChange`, with the value
 * being left. A render that changes nothing never reaches it, and neither
 * does the initial mount.
 */
export function useLayoutChangeSnapshot<T>(
	value: () => T,
	onBeforeChange: (previous: T) => void
): void {
	let previous = untrack(value);
	$effect.pre(() => {
		const next = value();
		untrack(() => {
			if (Object.is(previous, next)) {
				return;
			}
			const before = previous;
			previous = next;
			onBeforeChange(before);
		});
	});
}
