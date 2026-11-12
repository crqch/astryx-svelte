<script lang="ts" module>
	import type { ListReorderRowNameProps } from './list-reorder-types.js';

	export type { ListReorderRowNameProps };
</script>

<script lang="ts">
	import { useList } from './list-context.svelte.js';

	/**
	 * Names a reorderable List's row that has no handle, for the announcements
	 * of the moves beside it. That is a row that stays, or one without an item
	 * key. Renders nothing.
	 *
	 * Ported from Astryx's `ListReorderRowName`. A snippet label's text is read
	 * from the row's element after it renders.
	 */
	let { row, label }: ListReorderRowNameProps = $props();

	const list = useList();
	const controller = $derived(list?.()?.reorder?.session ?? null);
	let snippetText = $state('');

	$effect(() => {
		if (typeof label === 'string') {
			return;
		}
		const element = row();
		if (element == null) {
			return;
		}
		const next = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
		if (next !== snippetText) {
			snippetText = next;
		}
	});

	// Syncs the row's name into the reorder session, which lives outside
	// Svelte.
	$effect(() => {
		const element = row();
		if (element == null) {
			return;
		}
		const text = typeof label === 'string' ? label.replace(/\s+/g, ' ').trim() : snippetText;
		return controller?.registerName(element, text);
	});
</script>
