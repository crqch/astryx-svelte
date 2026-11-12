import { Context } from '../../internal/context.js';

/**
 * Svelte equivalent of Astryx's
 * `CheckboxInput/CheckboxRowPressContext.tsx`.
 *
 * A row around the checkbox that answers a press anywhere on it (a
 * `CheckboxListItem`) owns the touch press instead. The checkbox then carries
 * no press marker of its own, so the controller's innermost-wins rule finds the
 * row for a finger on the label, the description or the box. The row's overlay
 * paints that press.
 *
 * The context is *optional*: upstream's `use(CheckboxRowPressContext)` yields
 * `null` outside a row, so `getOr(false)` and a standalone checkbox owns its
 * own press.
 */
const CheckboxRowPressContext = new Context<() => boolean>('astryx.checkbox-row-press');

export function setCheckboxRowPress(get: () => boolean): void {
	CheckboxRowPressContext.set(get);
}

/** Whether an enclosing row owns the touch press, or `false` when standalone. */
export function useCheckboxRowPress(): boolean {
	return CheckboxRowPressContext.getOr(() => false)?.() ?? false;
}
