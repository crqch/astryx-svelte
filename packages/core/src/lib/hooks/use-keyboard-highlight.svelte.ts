import type { InteractionModality } from '../utils/interaction-modality.js';

/**
 * Ported from Astryx's `hooks/useKeyboardHighlight.ts`.
 *
 * A highlight moves from both keys and the pointer, but keyboard-only paint
 * follows the shared interaction modality. The hook reads that modality each
 * time the highlight moves.
 */
export interface KeyboardHighlight<KeyArgs extends unknown[], HoverArgs extends unknown[]> {
	/** The last highlight move came from keyboard input. */
	readonly isKeyboardHighlight: boolean;
	/** Records the current input for a path that moves the highlight. */
	noteHighlightMove: () => void;
	onKeyDown: (...args: KeyArgs) => void;
	onItemMouseEnter: (...args: HoverArgs) => void;
}

export function useKeyboardHighlight<KeyArgs extends unknown[], HoverArgs extends unknown[]>(
	readModality: () => InteractionModality,
	onKeyDown: (...args: KeyArgs) => void,
	onItemMouseEnter: (...args: HoverArgs) => void
): KeyboardHighlight<KeyArgs, HoverArgs> {
	let isKeyboardHighlight = $state(readModality() === 'keyboard');

	function noteHighlightMove(): void {
		isKeyboardHighlight = readModality() === 'keyboard';
	}

	return {
		get isKeyboardHighlight() {
			return isKeyboardHighlight;
		},
		noteHighlightMove,
		onKeyDown: (...args: KeyArgs) => {
			onKeyDown(...args);
			noteHighlightMove();
		},
		onItemMouseEnter: (...args: HoverArgs) => {
			onItemMouseEnter(...args);
			noteHighlightMove();
		}
	};
}
