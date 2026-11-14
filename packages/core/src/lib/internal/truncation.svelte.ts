import type { Attachment } from 'svelte/attachments';
import { observeResize } from './shared-resize-observer.js';
import { observeContent } from './shared-mutation-observer.js';

/**
 * Ported from Astryx's `Text/useTruncation.ts`.
 *
 * Upstream returns a ref callback; the Svelte equivalent is an attachment,
 * which gives the same mount/update/cleanup lifecycle without a ref to thread
 * through. The options arrive as a getter, so reading `maxLines` and
 * `isExpanded` inside the attachment registers them as dependencies.
 *
 * `isExpanded` keeps the answer the clamped text last measured, so a caption
 * that opens in full keeps its `More`/`Less` toggle mounted with its focus.
 *
 * @example
 * ```svelte
 * const truncation = useTruncation(() => ({ maxLines: 2 }));
 * <div {@attach truncation.attach}>{text}</div>
 * {#if truncation.isTruncated}<button>More</button>{/if}
 * ```
 */
export interface UseTruncationOptions {
	/** Maximum number of lines before truncation. 0 disables it. */
	maxLines: number;
	/** Pass true while the text is shown in full; the hook keeps its clamped answer. */
	isExpanded?: boolean;
}

export interface UseTruncationReturn {
	/** Whether the text is currently truncated (overflowing). */
	readonly isTruncated: boolean;
	/** The element's full text, for the tooltip. */
	readonly fullText: string;
	/** Attach to the clamped element with `{@attach truncation.attach}`. */
	readonly attach: Attachment<HTMLElement>;
}

export function useTruncation(options: () => UseTruncationOptions): UseTruncationReturn {
	let isTruncated = $state(false);
	let fullText = $state('');
	// The last measured answer, which the text keeps while it is expanded.
	let answer = { isTruncated: false, fullText: '' };
	// The text an expanded element kept its answer for when it went.
	let keptFor: HTMLElement | null = null;

	function check(element: HTMLElement, maxLines: number): void {
		if (maxLines === 0) {
			answer = { isTruncated: false, fullText: element.textContent ?? '' };
			isTruncated = false;
			fullText = answer.fullText;
			return;
		}

		answer.fullText = element.textContent ?? '';
		if (maxLines === 1) {
			answer.isTruncated = element.scrollWidth > element.offsetWidth;
		} else {
			// With `-webkit-line-clamp` active, browsers may report scrollHeight
			// as the clamped height, so the naive check silently returns false. A
			// Range over the contents measures the real text box.
			let contentHeight = element.scrollHeight;
			try {
				const range = element.ownerDocument.createRange();
				range.selectNodeContents(element);
				contentHeight = range.getBoundingClientRect().height;
				range.detach();
			} catch {
				// Fall back to scrollHeight where Range is unavailable.
			}
			answer.isTruncated = contentHeight > element.offsetHeight;
		}
		isTruncated = answer.isTruncated;
		fullText = answer.fullText;
	}

	const attach: Attachment<HTMLElement> = (element) => {
		const { maxLines, isExpanded = false } = options();

		// Shown in full, the text keeps the answer it had when clamped.
		if (isExpanded) {
			isTruncated = answer.isTruncated;
			fullText = answer.fullText;
			if (element != null) {
				keptFor = element;
			}
			return;
		}

		// A kept answer is about the text it measured. Other text starts from
		// none, as it does after its old element goes.
		const kept = keptFor;
		keptFor = null;
		if (kept != null && element !== kept) {
			answer = { isTruncated: false, fullText: '' };
			isTruncated = false;
			fullText = '';
		}

		if (maxLines === 0) {
			isTruncated = false;
			fullText = '';
			return;
		}

		// The shared observers: the first resize notification measures a new
		// element, and a text change that keeps the box's size still re-measures.
		const stopResize = observeResize(element, () => check(element, maxLines));
		const stopContent = observeContent(element, () => check(element, maxLines));
		return () => {
			stopResize();
			stopContent();
		};
	};

	return {
		get isTruncated() {
			return isTruncated;
		},
		get fullText() {
			return fullText;
		},
		attach
	};
}
