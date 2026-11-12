/** PORTS: gestures/__tests__/importGraph.test.ts */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Astryx's `gestures/__tests__/importGraph.test.ts`, restated for this port's
 * kebab-cased modules. Two upstream entries (`useGestureRecognizer.ts`,
 * `useFingerScroll.ts`) are React hooks this port has not rewritten as rune
 * hooks; the framework-free entry points that do exist are checked instead.
 */

const GESTURES = path.resolve(__dirname, '../lib/gestures');

/** The relative modules `file` imports for their values, resolved. */
function valueImports(file: string): string[] {
	const source = fs.readFileSync(file, 'utf8');
	const specifiers: string[] = [];
	const statement = /^\s*(import|export)\s+(type\s+)?([^'";]*?\s+from\s+)?'([^']+)';/gms;
	for (const match of source.matchAll(statement)) {
		const [, , isTypeOnly, , specifier] = match;
		if (isTypeOnly == null && specifier.startsWith('.')) {
			specifiers.push(specifier);
		}
	}
	return specifiers.map((specifier) => resolveModule(file, specifier));
}

function resolveModule(from: string, specifier: string): string {
	const base = path.resolve(path.dirname(from), specifier);
	// This port writes `.js` specifiers over `.ts` sources.
	const withoutJs = base.endsWith('.js') ? base.slice(0, -3) : base;
	for (const candidate of [
		`${withoutJs}.ts`,
		`${withoutJs}.tsx`,
		path.join(withoutJs, 'index.ts')
	]) {
		if (fs.existsSync(candidate)) return candidate;
	}
	throw new Error(`${path.relative(GESTURES, from)}: cannot resolve ${specifier}`);
}

function reachable(entry: string): Set<string> {
	const seen = new Set<string>();
	const queue = [path.join(GESTURES, entry)];
	while (queue.length > 0) {
		const file = queue.pop() as string;
		if (seen.has(file)) continue;
		seen.add(file);
		queue.push(...valueImports(file));
	}
	return new Set([...seen].map((file) => path.relative(GESTURES, file).replaceAll(path.sep, '/')));
}

describe('the gestures module graph', () => {
	it.each(['pan-gesture-recognizer.ts', 'gesture-host.ts', 'touch-action.ts'])(
		'%s reaches neither the press tracker nor haptics',
		(entry) => {
			const modules = reachable(entry);
			expect(modules.has(entry)).toBe(true);
			expect(modules).not.toContain('press-tracker.ts');
			expect(modules).not.toContain('haptics.ts');
		}
	);

	it('reaches haptics from its own entry, and the shared switch attribute from the host', () => {
		expect(reachable('haptics.ts')).toContain('../private-attributes/haptic-switch.ts');
		expect(reachable('gesture-host.ts')).toContain('../private-attributes/haptic-switch.ts');
	});

	it.each(['pan-gesture-recognizer.ts', 'gesture-host.ts', 'wheel-segmenter.ts'])(
		'%s reaches neither the page hold nor the finger-scroll watch',
		(entry) => {
			const modules = reachable(entry);
			expect(modules).not.toContain('page-hold.ts');
			expect(modules).not.toContain('finger-scroll.ts');
		}
	);

	it('reaches the finger-scroll watch from its own entry, and the page hold from its own entry', () => {
		expect(reachable('finger-scroll.ts')).toContain('finger-scroll.ts');
		// The page hold takes the host it holds for: it imports none of it.
		expect(reachable('page-hold.ts')).not.toContain('gesture-host.ts');
	});

	it.each(['gesture-host.ts', 'touch-action.ts', 'press-tracker.ts'])(
		'%s reaches no recognizer class: each brands its family',
		(entry) => {
			const modules = reachable(entry);
			expect(modules).not.toContain('tap-gesture-recognizer.ts');
			expect(modules).not.toContain('long-press-gesture-recognizer.ts');
			expect(modules).not.toContain('pan-gesture-recognizer.ts');
		}
	);

	it.each(['press-tracker.ts', 'finger-scroll.ts', 'page-hold.ts'])(
		'%s is a leaf entry: no gesture host value import',
		(entry) => {
			expect(reachable(entry)).not.toContain('gesture-host.ts');
		}
	);
});
