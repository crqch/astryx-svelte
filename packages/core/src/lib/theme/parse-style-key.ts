import { themeDataAttributeName } from '../internal/theme-props.js';

/** Escape a value for a double-quoted CSS attribute selector string. */
function escapeAttributeValue(value: string): string {
	let escaped = '';
	for (const char of value) {
		const codePoint = char.codePointAt(0) ?? 0;
		if (char === '"' || char === '\\' || codePoint < 0x20 || codePoint === 0x7f) {
			escaped += `\\${(codePoint === 0 ? 0xfffd : codePoint).toString(16)} `;
		} else {
			escaped += char;
		}
	}
	return escaped;
}

/**
 * Parse a component style key into a CSS data-attribute selector suffix.
 *
 * Ported from Astryx's `utils/parseStyleKey.ts`. Theme authors key component
 * overrides by the visual state they target, and this turns those keys into the
 * selector that `themeProps()`'s reflected `data-*` attributes satisfy:
 *
 * @example
 * parseStyleKey('base')                        // ''
 * parseStyleKey('checked')                     // '[data-checked="checked"]'
 * parseStyleKey('checked+disabled')            // '[data-checked="checked"][data-disabled="disabled"]'
 * parseStyleKey('variant:secondary')           // '[data-variant="secondary"]'
 * parseStyleKey('level:1')                     // '[data-level="1"]'
 * parseStyleKey('variant:destructive+size:sm') // '[data-variant="destructive"][data-size="sm"]'
 */
export function parseStyleKey(key: string): string {
	if (key === 'base') {
		return '';
	}

	return key
		.split('+')
		.map((part) => {
			const separator = part.indexOf(':');
			const prop = separator === -1 ? part : part.slice(0, separator);
			const value = separator === -1 ? part : part.slice(separator + 1);
			return `[${themeDataAttributeName(prop)}="${escapeAttributeValue(value)}"]`;
		})
		.join('');
}
