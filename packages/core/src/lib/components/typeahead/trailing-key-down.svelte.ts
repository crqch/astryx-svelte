import { Context } from '../../internal/context.js';

/**
 * Ported from Astryx's `Typeahead/trailingKeyDown.tsx`.
 *
 * Typeahead passes its consumer `onKeyDown` through this context so
 * `BaseTypeahead` calls it on the combobox input **after** its own key
 * handling: the consumer observes every key on the input and cannot cancel
 * built-in navigation, selection, or token editing (family:input-fields FR10).
 *
 * Keys on the field's other controls (the clear button, tokens) reach the
 * consumer through the wrapper's own key handler instead — this context is
 * scoped to the input.
 */
export type TrailingKeyDown = ((event: KeyboardEvent) => void) | undefined;

const trailingKeyDownContext = new Context<() => TrailingKeyDown>('astryx.trailingKeyDown');

/** Provide the consumer key handler to the `BaseTypeahead` below it. */
export function setTrailingKeyDownContext(get: () => TrailingKeyDown): void {
	trailingKeyDownContext.set(get);
}

/** The consumer key handler `BaseTypeahead` runs after its own, if any. */
export function useTrailingKeyDown(): (() => TrailingKeyDown) | null {
	return trailingKeyDownContext.getOr(null);
}
