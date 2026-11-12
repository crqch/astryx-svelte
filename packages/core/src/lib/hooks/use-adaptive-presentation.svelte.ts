import { useThemeContext } from '../theme/theme-context.js';

/**
 * Resolves `presentation="adaptive"` against the active theme's compact
 * definition, ported from Astryx's `hooks/useAdaptivePresentation.ts`.
 *
 * A sheet needs both a compact viewport and a coarse primary pointer: tablets
 * and large touch displays stay anchored, phones in either orientation get the
 * sheet. Compact is the active theme's definition (`widthBreakpoints.md`, then
 * the default 768px), plus the shared 500px height floor.
 *
 * Only an `adaptive` presentation subscribes to `matchMedia`; a fixed
 * presentation never reads the query, so it holds no listener for it. SSR-safe:
 * the server snapshot is "not compact", so the server and hydrating renders are
 * the popover, as upstream's are.
 */

export type AdaptivePresentation = 'popover' | 'bottom-sheet' | 'adaptive';
export type ResolvedAdaptivePresentation = Exclude<AdaptivePresentation, 'adaptive'>;

const DEFAULT_MD = 768;
const COMPACT_HEIGHT_BELOW = 500;

/** Both conditions, as the query typeahead and tokenizer sheets share it. */
export function compactTouchQuery(md: number = DEFAULT_MD): string {
	const width = `(width < ${md}px)`;
	const height = `(height < ${COMPACT_HEIGHT_BELOW}px)`;
	return `${width} and (pointer: coarse), ${height} and (pointer: coarse)`;
}

export interface AdaptivePresentationState {
	readonly resolved: ResolvedAdaptivePresentation;
}

export function useAdaptivePresentation(
	presentation: () => AdaptivePresentation
): AdaptivePresentationState {
	const themeContext = useThemeContext();
	let isCompactTouch = $state(false);

	$effect.pre(() => {
		if (presentation() !== 'adaptive') {
			isCompactTouch = false;
			return;
		}
		const md = themeContext?.().theme.adaptations?.widthBreakpoints?.md ?? DEFAULT_MD;
		const query = compactTouchQuery(md);
		const list = window.matchMedia(query);
		isCompactTouch = list.matches;
		const onChange = (event: MediaQueryListEvent): void => {
			isCompactTouch = event.matches;
		};
		list.addEventListener('change', onChange);
		return () => list.removeEventListener('change', onChange);
	});

	return {
		get resolved() {
			const value = presentation();
			if (value !== 'adaptive') {
				return value;
			}
			return isCompactTouch ? 'bottom-sheet' : 'popover';
		}
	};
}
