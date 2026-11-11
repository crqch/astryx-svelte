import type { Component } from 'svelte';

/**
 * The **page** templates, as lazy importers keyed by slug.
 *
 * A page template is a slug under `packages/cli/assets/templates/pages/`,
 * authored there because upstream ships page templates through the **CLI** as
 * scaffolding assets and the docsite merely renders them
 * (`port/ledger/022-page-templates.md`). Reaching out of `docs/` for them is
 * therefore the arrangement, not a workaround.
 *
 * **A separate glob from `example-modules.ts`, and that is a size decision.**
 * The landing page's Templates tile names the seven slugs it shows in source and
 * needs nothing else from the examples registry, whose own glob is a 629-entry
 * map that bundles to a 242 KB eager chunk. One glob per consumer keeps the
 * landing route from paying for the other gallery's index.
 *
 * The glob resolves to `{}` while a template is missing, so the caller gets a
 * `null` importer and can decide what to render — which is how the Templates
 * tile stays correct while transcription batches land.
 */
const templateModules = import.meta.glob<{ default: Component }>(
	'../../../../packages/cli/assets/templates/pages/*/+page.svelte'
);

/**
 * Re-keyed by slug.
 *
 * A *relative* glob is keyed by the pattern's own relative path, and rebuilding
 * a `../../../../…` string to look one up would encode this file's depth in two
 * places that must agree. Reading the slug back out of whatever keys Vite
 * produced cannot drift.
 */
const templateModulesBySlug: Record<string, () => Promise<{ default: Component }>> =
	Object.fromEntries(
		Object.entries(templateModules).map(([key, load]) => {
			const segments = key.split('/');
			return [segments[segments.length - 2], load];
		})
	);

/** The page template's importer, or null when its transcription has not landed. */
export function templateImporterFor(slug: string): (() => Promise<{ default: Component }>) | null {
	return templateModulesBySlug[slug] ?? null;
}
