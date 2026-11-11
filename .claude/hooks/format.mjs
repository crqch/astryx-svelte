// PostToolUse hook: format the file Claude just wrote with oxfmt.
//
// The config lives at the repo root (`.oxfmtrc.json`) and is the same one the
// lint gate reads, so a file the hook leaves alone is a file `oxfmt --check`
// accepts. Files inside an ignored tree — the vendored upstream clone, the
// frozen ledger/research prose, build output — are skipped rather than
// reformatted: those trees are deliberately outside the formatter's contract.
//
// Bun rather than Node, matching the rest of the repo's tooling. The process
// exits 0 on every failure: a syntax error mid-edit is normal, and a hook that
// fails a tool call over it is worse than one that formats nothing.

import fs from 'node:fs/promises';
import path from 'node:path';
import { format } from 'oxfmt';

const exit = () => process.exit(0);

const stdin = await new Promise((resolve) => {
	let buf = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', (d) => (buf += d));
	process.stdin.on('end', () => resolve(buf));
	process.stdin.on('error', () => resolve(''));
});

let file;
try {
	const payload = JSON.parse(stdin);
	file = payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;
} catch {
	exit();
}
if (!file) exit();

const abs = path.resolve(file);
const relative = abs.split(path.sep).join('/');

const IGNORED = [
	'/node_modules/',
	'/reference/',
	'/port/ledger/',
	'/port/design/',
	'/port/research/',
	'/.svelte-kit/',
	'/.vercel/',
	'/dist/',
	'/packages/cli/assets/docs/',
	'/packages/cli/assets/templates/',
	'/packages/core/src/lib/locales/'
];
if (IGNORED.some((part) => relative.includes(part))) exit();

const FORMATTABLE = /\.(?:[cm]?[jt]sx?|jsonc?|css|scss|less|md|svelte|html|ya?ml|toml)$/;
if (!FORMATTABLE.test(abs)) exit();

try {
	await fs.access(abs);
} catch {
	exit();
}

/** Walk up from the edited file until the repo config is found. */
async function resolveConfig(from) {
	let dir = path.dirname(from);
	while (true) {
		const candidate = path.join(dir, '.oxfmtrc.json');
		try {
			await fs.access(candidate);
			return JSON.parse(await fs.readFile(candidate, 'utf8'));
		} catch {
			const parent = path.dirname(dir);
			if (parent === dir) return null;
			dir = parent;
		}
	}
}

try {
	const config = await resolveConfig(abs);
	if (!config) exit();
	const { $schema, ignorePatterns, ...options } = config;
	const src = await fs.readFile(abs, 'utf8');
	const result = await format(abs, src, options);
	if (result.errors.length === 0 && result.code !== src) {
		await fs.writeFile(abs, result.code, 'utf8');
	}
} catch {
	// A syntax error mid-edit is normal; never fail the hook over it.
	exit();
}
