/** PORTS: gestures/__tests__/touchActionRule.test.ts */

/**
 * @file touchActionRule.test.ts
 * @input markTouchAction and unmarkTouchAction on a document
 * @output Where the rule lives: an adopted constructable sheet where the
 *   engine has one, a style element where it has none, and an error from a
 *   constructable sheet that exists is not taken for a missing one
 * @position Unit test of gestures/touchActionRule.ts
 *
 * Both cases run in a fresh iframe document. The rule store is keyed by root
 * and lives as long as the document, so the page's own document already holds
 * an adopted sheet from other suites; upstream's per-file jsdom document does
 * not.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { markTouchAction, unmarkTouchAction } from '$lib/gestures/touch-action-rule.js';

let frame: HTMLIFrameElement | null = null;

function freshDocument(): { doc: Document; view: Window } {
	frame = document.createElement('iframe');
	document.body.append(frame);
	return { doc: frame.contentDocument!, view: frame.contentWindow! };
}

afterEach(() => {
	frame?.remove();
	frame = null;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('touchActionRule', () => {
	it('writes the rule into a style element where the engine has no constructable sheets', () => {
		// RESTATED: this browser has constructable sheets, where jsdom has none.
		// An engine without them is the same branch: no `CSSStyleSheet`
		// constructor to make one with.
		const { doc, view } = freshDocument();
		Object.defineProperty(view, 'CSSStyleSheet', { configurable: true, value: undefined });
		const element = doc.createElement('div');
		doc.body.append(element);
		expect(markTouchAction(element, 'pan-y')).toBe(true);
		expect(doc.head.querySelector('style')?.textContent).toContain('pan-y');
		unmarkTouchAction(element);
	});

	it('lets an error from a constructable sheet that exists through, instead of taking it for a missing one', () => {
		const { doc, view } = freshDocument();
		class BrokenSheet {
			constructor() {
				throw new Error('broken sheet');
			}
			replaceSync(): void {}
		}
		Object.defineProperty(view, 'CSSStyleSheet', { configurable: true, value: BrokenSheet });
		const element = doc.createElement('div');
		doc.body.append(element);
		expect(() => markTouchAction(element, 'pan-x')).toThrow('broken sheet');
	});
});
