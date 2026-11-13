#!/usr/bin/env bun
/**
 * Publishes every public workspace package with Bun.
 *
 * `pnpm publish -r` has no Bun counterpart: `bun publish` always operates on
 * one package, so this script walks the root `workspaces` globs, skips private
 * manifests, and runs `bun publish` in each remaining directory in dependency
 * order (the order the globs list them, which puts core before the themes).
 *
 * Bun rewrites `workspace:*` and `workspace:^` to real ranges at pack time,
 * the same way pnpm does; without that rewrite the protocols would be published
 * literally and the tarballs would be uninstallable.
 *
 * Usage:
 *   bun scripts/publish.mjs [--dry-run]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');

/** Expand the root `workspaces` globs into package directories. */
function workspaceDirs() {
	const rootManifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
	const dirs = [];
	for (const pattern of rootManifest.workspaces ?? []) {
		// Every pattern in this repo ends in `/*`; a literal path is accepted too.
		if (!pattern.endsWith('/*')) {
			if (existsSync(path.join(root, pattern, 'package.json'))) dirs.push(pattern);
			continue;
		}
		const parent = pattern.slice(0, -2);
		for (const entry of readdirSync(path.join(root, parent), { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const rel = path.join(parent, entry.name);
			if (existsSync(path.join(root, rel, 'package.json'))) dirs.push(rel);
		}
	}
	return dirs.sort();
}

const targets = [];
for (const dir of workspaceDirs()) {
	const manifest = JSON.parse(readFileSync(path.join(root, dir, 'package.json'), 'utf8'));
	if (manifest.private === true) continue;
	if (!manifest.name || !manifest.version) {
		throw new Error(`${dir}/package.json has no name or version; refusing to publish.`);
	}
	targets.push({ dir, name: manifest.name, version: manifest.version });
}

if (targets.length === 0) {
	console.error('No publishable workspace packages found.');
	process.exit(1);
}

console.log(
	`${dryRun ? 'Dry-running' : 'Publishing'} ${targets.length} package(s): ` +
		targets.map((t) => `${t.name}@${t.version}`).join(', ')
);

/**
 * `bun publish` runs `prepack` through the system shell, and this Bun version
 * does not add `node_modules/.bin` to that script's PATH. Core's prepack calls
 * `svelte-kit`, which then resolves only if both the package and root bins are
 * on PATH. A normal `bun run prepack` already does this; publish apparently
 * does not.
 *
 * @param {string} dir workspace-relative package directory
 */
function publishEnv(dir) {
	const bins = [
		path.join(root, dir, 'node_modules', '.bin'),
		path.join(root, 'node_modules', '.bin')
	];
	return {
		...process.env,
		PATH: [...bins, process.env.PATH].filter(Boolean).join(path.delimiter)
	};
}

for (const target of targets) {
	const args = ['publish', '--access', 'public'];
	if (dryRun) args.push('--dry-run');
	console.log(`\n=== ${target.name}@${target.version} ===`);
	execFileSync('bun', args, {
		cwd: path.join(root, target.dir),
		stdio: 'inherit',
		env: publishEnv(target.dir)
	});
}
