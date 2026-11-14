/**
 * Ported from Astryx's `i18n/firstStrongDirection.ts`.
 *
 * The direction of the first strongly directional character in a string, or
 * null when it has none. Server-safe: it reads no context.
 */

// Each expression with a Unicode property escape is built at runtime: a
// source build may rewrite a regular expression literal with one.

/**
 * The strongly right-to-left characters of the Unicode Bidirectional
 * Algorithm: Bidi_Class `R` and `AL`.
 */
const STRONG_RTL = new RegExp(
	String.raw`[\p{Script=Adlam}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Mandaic}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Syriac}\p{Script=Thaana}\u200F\u061C\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]`,
	'u'
);

/**
 * The weak characters of the Arabic script: its digits, the number signs
 * before them, and the currency and per-cent marks beside them.
 */
const WEAK_ARABIC_NUMBER =
	/[\u0600-\u0605\u0609\u060A\u0660-\u0669\u066A-\u066C\u06DD\u06F0-\u06F9\u0890\u0891\u08E2]/u;

/** Bidi_Class `L`: every other letter, the letter numbers, and the LTR mark. */
const STRONG_LTR = new RegExp(String.raw`[\p{Letter}\p{Nl}\u200E]`, 'u');

/** Bidi_Class `NSM`: a combining mark takes the direction of its base. */
const COMBINING_MARK = new RegExp(String.raw`\p{Mark}`, 'u');

/** Whether the text holds a strongly right-to-left character anywhere. */
export function hasStrongRightToLeft(text: string): boolean {
	for (const character of text) {
		if (STRONG_RTL.test(character)) {
			return true;
		}
	}
	return false;
}

/**
 * Rules P2 and P3 of the Unicode Bidirectional Algorithm: the direction of
 * the first strongly directional character, or null when there is none.
 */
export function firstStrongDirection(text: string): 'ltr' | 'rtl' | null {
	for (const character of text) {
		if (COMBINING_MARK.test(character) || WEAK_ARABIC_NUMBER.test(character)) {
			continue;
		}
		if (STRONG_RTL.test(character)) {
			return 'rtl';
		}
		if (STRONG_LTR.test(character)) {
			return 'ltr';
		}
	}
	return null;
}
