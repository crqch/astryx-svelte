<script lang="ts">
	import ShowcaseThumbnail from '$lib/shell/showcase-thumbnail.svelte';
	import { templateImporterFor } from '$lib/shell/page-template-modules.js';

	/**
	 * The Templates bento tile — upstream's `_landing/TemplatesPreview.tsx`.
	 *
	 * Seven live page templates, rendered at a desktop width and scaled into
	 * uniform tiles: storefront, IDE, payment, login, settings, AI chat and
	 * product detail. The middle row holds three so the centred (`login-split`)
	 * template sits in the middle; the outer two bleed off the card edges in the
	 * narrow three-column desktop grid.
	 *
	 * On a wide card — the single-column stack on small screens — the rows
	 * dissolve into one three-column grid, so seven tiles would leave a lone
	 * seventh; `product-detail` is hidden there to keep a clean three + three.
	 *
	 * Every template is transcribed in `packages/cli/assets/templates/pages/` and
	 * resolved through the same lazy importer the galleries use. A slug whose
	 * transcription has not landed resolves to `null`, and `ShowcaseThumbnail`
	 * renders its empty frame rather than the tile disappearing — so the
	 * composition is upstream's from the first batch and fills in as templates
	 * arrive.
	 */
	interface Props {
		/**
		 * Cap the number of thumbnail rows rendered. Defaults to all rows; pass
		 * e.g. 2 to show only the first two rows in a more compact card.
		 */
		maxRows?: number;
	}

	const { maxRows }: Props = $props();

	// A representative set of the real page templates (storefront, IDE, payment,
	// login, settings, AI chat, product detail). Grouped into rows; the middle row
	// holds three so the centred (login) template sits in the middle.
	const TEMPLATE_ROWS: string[][] = [
		['product-gallery', 'ide'],
		['payment-form', 'login-split', 'settings-sidebar'],
		['ai-chat-landing', 'product-detail']
	];

	// On small screens the rows flow into a single 3-column grid; 7 templates would
	// leave a lone 7th tile, so this one is dropped there to keep a clean 3 + 3.
	const HIDE_ON_SMALL = 'product-detail';

	// Desktop width each template renders at before being shrunk to fit — a
	// desktop width shows the WHOLE page composition (nav + hero + content), not
	// a zoomed-in top-left corner.
	const RENDER_WIDTH = 1100;
	// Uniform tile aspect ratio so every block is the same height (and, in a 2-col
	// grid, the same width). Slightly taller than 16/10 to show a bit more.
	const TILE_RATIO = '16 / 11.5';

	const rows = $derived(
		(maxRows != null ? TEMPLATE_ROWS.slice(0, maxRows) : TEMPLATE_ROWS).map((row) =>
			row.map((slug) => ({ slug, load: templateImporterFor(slug) }))
		)
	);
</script>

<div class="container" inert>
	<div class="root">
		{#each rows as row, rowIndex (rowIndex)}
			<div class="row {row.length === 3 ? 'cols3' : 'cols2'}">
				{#each row as tile (tile.slug)}
					<div class="tile {tile.slug === HIDE_ON_SMALL ? 'hide-on-wide' : ''}">
						<!--
							borderRadius="0" so the thumbnail fills the tile's rounded corners
							flush — the tile already rounds + clips, so the thumbnail's own
							--radius-container would otherwise nest a second, mismatched
							radius. A page template renders transparent, so the thumbnail is
							backed by the app surface, as upstream's TemplateThumbnail is.
						-->
						<ShowcaseThumbnail
							load={tile.load}
							aspectRatio={TILE_RATIO}
							renderWidth={RENDER_WIDTH}
							borderRadius="0"
							background="var(--color-background-surface)"
							layout="page"
						/>
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	/*
	 * Query container — a plain wrapper whose width the layout responds to. (A
	 * container cannot respond to its OWN @container query, so the responsive
	 * layout lives on a descendant.)
	 */
	.container {
		container-type: inline-size;
		container-name: templatesPreview;
		width: 100%;
		/* Decorative — never interactive. */
		pointer-events: none;
	}

	/*
	 * Narrow card: a flex-column stack of 2-per-row groups (each row offset and
	 * bled). Wide card: a single 3-column grid — the row wrappers dissolve via
	 * display:contents below, so all six tiles flow into these three columns.
	 */
	.root {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
		width: 100%;
	}

	/*
	 * Narrow card: each row is a uniform grid, centred so the extra width bleeds
	 * evenly off both edges (clipped by the card's overflow). Wide card: the row
	 * wrapper dissolves so its tiles flow into the root's 3-column grid.
	 */
	.row {
		display: grid;
		gap: var(--spacing-5);
	}

	/* 2-up row: 150% wide → each tile ≈ 75% of the card. Centred. */
	.cols2 {
		grid-template-columns: 1fr 1fr;
		width: 150%;
		margin-inline: -25%;
	}

	/*
	 * 3-up row: 225% wide so each tile is the SAME ~75%-of-card size as the 2-up
	 * rows (3 × 75% = 225%). Centred, so the middle tile is fully visible and the
	 * outer two bleed off the edges (clipped).
	 */
	.cols3 {
		grid-template-columns: repeat(3, 1fr);
		width: 225%;
		margin-inline: -62.5%;
	}

	@container templatesPreview (min-width: 400px) {
		.root {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
		}

		.row {
			display: contents;
		}
	}

	/* Frame each thumbnail with a subtle border + clip and an elevation shadow so
	   each scaled page reads as a tidy, lifted card tile rather than a flat render. */
	.tile {
		border-radius: var(--radius-inner);
		overflow: hidden;
		border: 1px solid var(--color-border);
		background-color: var(--color-background-surface);
		box-shadow: var(--shadow-med);
	}

	/* Hidden on a wide card (small screens): with 7 templates the dissolved
	   3-column grid would leave a lone 7th tile (3 + 3 + 1), so one tile drops out
	   to keep a clean 3 + 3. It still shows in the narrow-card desktop layout. */
	.hide-on-wide {
		display: block;
	}

	@container templatesPreview (min-width: 400px) {
		.hide-on-wide {
			display: none;
		}
	}
</style>
