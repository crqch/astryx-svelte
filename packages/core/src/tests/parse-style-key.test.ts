/** PORTS: utils/parseStyleKey.test.ts */

import { describe, expect, it } from 'vitest';
import { parseStyleKey } from '$lib/theme/parse-style-key.js';

/**
 * Astryx's `utils/parseStyleKey.test.ts`, ported case for case at the 0.7.13
 * tag. Nothing dropped, nothing added.
 *
 * A **server** project file (`*.test.ts`), as upstream's is: the parser turns a
 * style key into a selector suffix and touches nothing else.
 *
 * The module sits under `theme/` here rather than `utils/`, beside the theme
 * compiler that is its only caller — one of the "two homes for one upstream
 * dir" placements recorded in `port/todo.md`. Only the import path differs.
 */
describe('parseStyleKey', () => {
	it('returns no suffix for base', () => {
		expect(parseStyleKey('base')).toBe('');
	});

	it('preserves the prop axis in data-attribute selectors', () => {
		expect(parseStyleKey('variant:secondary')).toBe('[data-variant="secondary"]');
		expect(parseStyleKey('size:sm')).toBe('[data-size="sm"]');
	});

	it('keeps numeric values literal', () => {
		expect(parseStyleKey('level:2')).toBe('[data-level="2"]');
	});

	it('kebab-cases camelCase prop names', () => {
		expect(parseStyleKey('listStyle:ordered')).toBe('[data-list-style="ordered"]');
	});

	it('combines multiple prop selectors', () => {
		expect(parseStyleKey('variant:destructive+size:sm')).toBe(
			'[data-variant="destructive"][data-size="sm"]'
		);
	});

	it('converts bare states to reflected state attributes', () => {
		expect(parseStyleKey('checked')).toBe('[data-checked="checked"]');
		expect(parseStyleKey('checked+disabled')).toBe(
			'[data-checked="checked"][data-disabled="disabled"]'
		);
	});

	it('combines a prop selector and a bare state selector', () => {
		expect(parseStyleKey('variant:destructive+disabled')).toBe(
			'[data-variant="destructive"][data-disabled="disabled"]'
		);
	});

	it('escapes CSS string metacharacters in values', () => {
		expect(parseStyleKey('variant:quote"slash\\')).toBe('[data-variant="quote\\22 slash\\5c "]');
	});

	it('preserves empty values for compatibility', () => {
		expect(parseStyleKey('variant:')).toBe('[data-variant=""]');
	});
});
