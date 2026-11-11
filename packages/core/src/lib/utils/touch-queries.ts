/**
 * Ported from Astryx's `utils/touchQueries.ts` — the dependency-free half, for
 * code that loads without React or the theme.
 */

/** The primary pointer is coarse: touch behaviours. */
export const TOUCH_QUERY = '(pointer: coarse)';

/** The engine is WebKit on iOS or iPadOS. */
export const IOS_SUPPORTS_QUERY = '(-webkit-touch-callout: none)';

/** Whether `view`'s engine is iOS WebKit, by {@link IOS_SUPPORTS_QUERY}. */
export function isIosWebKit(
	view: { CSS?: Partial<Pick<typeof CSS, 'supports'>> } | null | undefined = globalThis
): boolean {
	return view?.CSS?.supports?.(IOS_SUPPORTS_QUERY) === true;
}
