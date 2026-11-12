import { Context } from '../internal/context.js';

/**
 * Ported from Astryx's `hooks/pressGroupContext.ts`.
 *
 * The pointer types a group's tracker follows on its actions, such as
 * `['touch', 'pen']`, or null outside a tracking group. Those actions take no
 * `:active` paint, so one press never lights two.
 *
 * Svelte's context is read once at a component's initialisation, so each
 * context stores a getter; consumers call it inside `$derived` and stay live.
 */
export const PressGroupContext = new Context<() => ReadonlyArray<string> | null>(
	'PressGroupContext'
);

export function setPressGroupContext(get: () => ReadonlyArray<string> | null): void {
	PressGroupContext.set(get);
}

/** Returns a getter, or null when the component is not inside a tracking group. */
export function usePressGroupContext(): (() => ReadonlyArray<string> | null) | null {
	return PressGroupContext.getOr(null);
}

/**
 * Whether a tracking group draws this action's touch band. Such a group's band
 * covers its tracked actions, and it reads their targets when a press begins.
 * So an action in it draws no band of its own.
 */
export const PressGroupBandContext = new Context<() => boolean>('PressGroupBandContext');

export function setPressGroupBandContext(get: () => boolean): void {
	PressGroupBandContext.set(get);
}

/** Returns a getter, or null when the component is not inside a tracking group. */
export function usePressGroupBandContext(): (() => boolean) | null {
	return PressGroupBandContext.getOr(null);
}

// Button reads the marker here, not from its private StyleX module: a swizzled
// Button imports each StyleX module by its public path.
export { pressGroupItemProps } from '../private-attributes/press-group-item.stylex.js';
