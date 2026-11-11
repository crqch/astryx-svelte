/** PORTS: motion/animatedLayout.boundary.test.ts */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Astryx's `motion/animatedLayout.boundary.test.ts`, restated for this port's
 * kebab-cased modules and current adoption surface. The module itself is a
 * direct port: the walk and no-layout-property checks are unchanged. Its
 * adopters are not wired yet, so the "only the hook and adopters use it" case
 * records that gap explicitly rather than pretending the React file list.
 */

const here = dirname(fileURLToPath(import.meta.url));
const libSrc = join(here, '..', 'lib');
const moduleSource = readFileSync(join(libSrc, 'motion', 'animated-layout.ts'), 'utf8');

function code(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			if (name !== 'node_modules' && name !== 'tests') out.push(...sourceFiles(path));
		} else if (/\.(ts|tsx|svelte)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) {
			out.push(path);
		}
	}
	return out;
}

describe('architecture:react-component-runtime INV12 source boundary', () => {
	it('animates no layout property: only translate, opacity and the entrance clip', () => {
		const body = code(moduleSource);
		expect(body).not.toMatch(
			/(?:^|[{,])\s*(height|width|top|left|right|bottom|margin\w*|padding\w*|inset\w*)\s*:/m
		);
		const animated = [...body.matchAll(/[{,\s](translate|opacity|clipPath)\s*:/g)]
			.map((match) => match[1])
			.sort();
		expect([...new Set(animated)]).toEqual(['clipPath', 'opacity', 'translate']);
	});

	it('walks only through parentElement and the element siblings on either side, entering display: contents alone, and stops at the band', () => {
		const body = code(moduleSource);
		for (const forbidden of [
			'TreeWalker',
			'createTreeWalker',
			'querySelector',
			'getElementsBy',
			'.children',
			'childNodes'
		]) {
			expect(body, forbidden).not.toContain(forbidden);
		}
	});

	it('keeps the reporting functions out of every public entry point', () => {
		const entries = [join(libSrc, 'index.ts'), join(libSrc, 'hooks', 'index.ts')];
		for (const entry of entries) {
			if (!existsSync(entry)) continue;
			const source = readFileSync(entry, 'utf8');
			for (const name of [
				'reportLayoutChange',
				'playLayoutChange',
				'applyLayoutChangeTransition',
				'createAnimatedLayout',
				'holdLayoutSwap',
				'playLayoutSwap',
				'playLayoutFrames',
				'holdLayoutEdge',
				'playLayoutEdge',
				'reportLayoutEdge'
			]) {
				expect(source, `${relative(libSrc, entry)} exports ${name}`).not.toMatch(
					new RegExp(`\\b${name}\\b`)
				);
			}
		}
	});

	it("keeps the copy mechanism to the swap and the layer's exit copy", () => {
		const users = sourceFiles(libSrc)
			.filter((path) => /from '[./]+transient-copy/.test(readFileSync(path, 'utf8')))
			.map((path) => relative(libSrc, path).replaceAll('\\', '/'))
			.sort();
		// The Layer copy and List reorder adopters are not ported yet.
		expect(users).toEqual(['motion/animated-layout.ts']);
	});

	it("keeps the inert clone to the copy mechanism and the reorder's preview", () => {
		const users = sourceFiles(libSrc)
			.filter((path) => /from '[./]+inert-clone/.test(readFileSync(path, 'utf8')))
			.map((path) => relative(libSrc, path).replaceAll('\\', '/'))
			.sort();
		// The List reorder adapter is not ported yet.
		expect(users).toEqual(['motion/animated-layout.ts', 'motion/transient-copy.ts']);
	});

	it('is used only by the hook and the components that adopt it', () => {
		const users = sourceFiles(libSrc)
			.filter((path) => path !== join(libSrc, 'motion', 'animated-layout.ts'))
			.filter((path) => /from '[./]+animated-layout/.test(readFileSync(path, 'utf8')))
			.map((path) => relative(libSrc, path).replaceAll('\\', '/'))
			.sort();
		// PORT NOTE: no adopter is wired yet; the hook/component adoption is the
		// remaining animatedLayout work recorded in port/debts.md.
		expect(users).toEqual([]);
	});
});
