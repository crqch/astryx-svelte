/**
 * Ported from Astryx's `hooks/useAnnounceRenderedText.ts` (0.7.13).
 *
 * Announces the text a rendered element contains through the polite live
 * region, or through the owner's announcer.
 *
 * ## The Svelte translation
 *
 * Upstream runs its effect on every render because the text lives in the DOM
 * and a caller can change it without a prop the hook sees. Svelte effects track
 * the values they read, so a parent re-render is not an event this hook has.
 * The rendered content is therefore observed: a mutation under the element
 * reads the text again. That observer belongs to this module, not to an
 * adopter, which is what `useAnnounceRenderedText.adopters.test.tsx`'s INV10
 * check requires.
 *
 * Reactive inputs are getters, following this port's hook convention: the
 * element is a `bind:this` target that is still null at call time, and both
 * `isShown` and `occasion` are usually derived state.
 */

import { observeMutations } from '../internal/shared-mutation-observer.js';
import { useAnnounce, type AnnounceFn, type AnnouncePoliteness } from './use-announce.js';

const LIVE_CONTAINER =
	'[role="log"], [role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]';
const HIDDEN = '[aria-hidden="true"], [hidden]';
const BLOCKS = 'p, div, li, br, h1, h2, h3, h4, h5, h6';

/**
 * Each child element's rendered text as its own block, joined by spaces. Text
 * placed directly in the element, beside its child elements, counts as a block
 * too (a status bar is an icon followed by its bare message).
 */
function blockText(element: HTMLElement): string {
	return Array.from(element.childNodes)
		.map((child) => {
			if (child.nodeType === Node.TEXT_NODE) {
				return (child.textContent ?? '').replace(/\s+/g, ' ').trim();
			}
			// By node type, not `instanceof`: an element from another document's
			// window (a portal into a same-origin iframe) fails this window's
			// constructor checks.
			if (child.nodeType === Node.ELEMENT_NODE) {
				const part = child as HTMLElement;
				return part.matches(HIDDEN) ? '' : renderedText(part);
			}
			return '';
		})
		.filter((part) => part !== '')
		.join(' ');
}

export interface AnnounceRenderedTextOptions {
	/**
	 * Text that is present or changes while the document loads or hydrates is
	 * silent. Text that appears or changes later is announced once. A mounted
	 * live container speaks its own content, and each child is a block. A
	 * reveal without a re-render is read on the next mutation or render.
	 */
	skipFirstRender?: boolean;
	/**
	 * The urgency: assertive for errors and time-critical failures, else
	 * polite. Defaults to polite.
	 */
	politeness?: AnnouncePoliteness;
	/** Accessible name to announce when the element has no rendered text. */
	fallbackText?: string;
	/**
	 * The owner's announcer, when the rendered text states the next value of
	 * that announcer's state. For example, a picker's empty-panel message goes
	 * through its search's `hasReplace` instance, so the two replace each other
	 * while not yet exposed. Defaults to this hook's own instance.
	 */
	announce?: AnnounceFn;
}

/**
 * The rendered text an assistive technology would read from `element`. Block
 * boxes read apart: a block tag, an element whose computed display is not
 * inline, and any child of a flex or grid container (which the layout
 * blockifies), so two stacked `Text` spans never run together. Hidden parts
 * are skipped; nothing on screen changes.
 */
export function renderedText(element: HTMLElement): string {
	const view = element.ownerDocument.defaultView;
	const displayOf = (node: Element) => view?.getComputedStyle(node).display ?? '';
	const parts: string[] = [];
	const walk = (node: Node, parentDisplay: string) => {
		if (node.nodeType === Node.TEXT_NODE) {
			parts.push(node.textContent ?? '');
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			return;
		}
		const part = node as Element;
		if (part.matches(HIDDEN)) {
			return;
		}
		const display = displayOf(part);
		const isBlock =
			part.matches(BLOCKS) ||
			(display !== '' && display !== 'contents' && !display.startsWith('inline')) ||
			/\b(flex|grid)\b/.test(parentDisplay);
		if (isBlock) {
			parts.push(' ');
		}
		part.childNodes.forEach((child) => walk(child, display));
		if (isBlock) {
			parts.push(' ');
		}
	};
	const ownDisplay = displayOf(element);
	element.childNodes.forEach((child) => walk(child, ownDisplay));
	return parts.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Announce the text of a rendered element through the shared polite live
 * region, once per occasion.
 *
 * Announces when the element appears and whenever its rendered text changes.
 * Pass `isShown` false for every state where the element is not on screen —
 * including while loading — and the hook stays silent and re-arms.
 *
 * @param element - Getter for the element whose rendered text to speak
 * @param isShown - Getter for whether that element is currently on screen
 * @param occasion - Getter marking a new reason to speak the same words again;
 *   for a search dead end this is the query, so each new query that matches
 *   nothing is announced rather than only the first
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   let emptyStateEl = $state<HTMLDivElement>();
 *   useAnnounceRenderedText(
 *     () => emptyStateEl,
 *     () => isPanelEmpty,
 *     () => searchQuery
 *   );
 * </script>
 * ```
 */
export function useAnnounceRenderedText(
	element: () => HTMLElement | null | undefined,
	isShown: () => boolean,
	occasion: () => string,
	{
		skipFirstRender = false,
		politeness = 'polite',
		fallbackText,
		announce: ownerAnnounce
	}: AnnounceRenderedTextOptions = {}
): void {
	const ownAnnounce = useAnnounce();
	const announce = ownerAnnounce ?? ownAnnounce;
	let spoken: string | null = null;
	// Captured once: an owner rendered before the document finished loading, or
	// hydrated from server HTML, is part of the page the person arrived at.
	// Svelte exposes no public hydration flag; `readyState` is the same signal
	// upstream's second condition uses, and covers a module script that runs
	// before the load event. On the server there is no document, and effects do
	// not run there either.
	const renderedWithPage = typeof document === 'undefined' || document.readyState !== 'complete';
	let isFirstRun = true;

	function sync(): void {
		const isFirstRunNow = isFirstRun;
		isFirstRun = false;
		const target = element();
		const shown = isShown();
		if (!shown || target?.closest(HIDDEN) || target?.checkVisibility?.() === false) {
			spoken = null;
			return;
		}
		if (!target) {
			return;
		}
		if (skipFirstRender && target.parentElement?.closest(LIVE_CONTAINER)) {
			return;
		}
		let text = skipFirstRender ? blockText(target) : renderedText(target);
		if (text === '' && fallbackText !== undefined) {
			text =
				(target.getAttribute('aria-labelledby') ?? '')
					.split(/\s+/)
					.map((id) => {
						// Each referenced element as read: its hidden parts dropped, as
						// the accessible name drops them.
						const referenced = target.ownerDocument.getElementById(id);
						return referenced == null ? '' : renderedText(referenced);
					})
					.join(' ')
					.replace(/\s+/g, ' ')
					.trim() || fallbackText;
		}
		if (text === '') {
			// Nothing readable on screen either, so there is no announcement that
			// would match what the sighted user is seeing.
			return;
		}
		const nowSpoken = `${occasion()}\u0000${text}`;
		if (spoken === nowSpoken) {
			return;
		}
		spoken = nowSpoken;
		const isPageLoad = (isFirstRunNow && renderedWithPage) || document.readyState !== 'complete';
		if (skipFirstRender && isPageLoad) {
			// Part of the page the person arrived at: remember it, say nothing.
			return;
		}
		announce(text, politeness);
	}

	// Runs after the DOM update for any reactive input the caller derives the
	// text or visibility from.
	$effect(() => {
		void element();
		void isShown();
		void occasion();
		sync();
	});

	// The text itself may change without a prop this hook reads. Observe the
	// element's content and attributes; the dedupe above makes the extra reads
	// no-ops.
	$effect(() => {
		const target = element();
		if (target == null) {
			return;
		}
		return observeMutations(
			target,
			{ attributes: true, childList: true, characterData: true, subtree: true },
			() => sync()
		);
	});
}
