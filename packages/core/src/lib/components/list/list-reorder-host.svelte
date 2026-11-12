<script lang="ts" module>
	import type { ListReorderContextValue } from './list-reorder-context.svelte.js';

	export interface ListReorderHostProps {
		reorder: ListReorderContextValue;
	}
</script>

<script lang="ts">
	import { useAnnounce } from '../../hooks/use-announce.js';
	import { useMediaQuery } from '../../hooks/use-media-query.svelte.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { TOUCH_QUERY } from '../../utils/touch-queries.js';
	import { messagesFrom, type ListReorderController } from './list-reorder-engine.js';
	import ListReorderModeHint from './list-reorder-mode-hint.svelte';

	/**
	 * Renders beside a reorderable List's rows. It keeps its session's options,
	 * strings and presentation current, and attaches the list's listeners. The
	 * touch hold attaches under every primary pointer. It also renders the
	 * handles' instructions and the reorder-mode hint.
	 *
	 * Ported from Astryx's `ListReorderHost`. The React layout effects become
	 * `$effect`s; each one's cleanup is the effect's return, so the disposer and
	 * the listeners detach exactly when the host goes.
	 */
	let { reorder }: ListReorderHostProps = $props();

	const controller = $derived(reorder.session as ListReorderController);
	const announce = useAnnounce();
	const t = useTranslator();
	// UIKit's motion under a finger (one touch model on every touch device);
	// with a mouse, rows take their places at once.
	const isTouch = useMediaQuery(() => TOUCH_QUERY, false);

	// Syncs the reorder session, which lives outside Svelte, with this render's
	// options, strings and presentation.
	$effect(() => {
		controller.configure({
			options: reorder.options,
			announce,
			messages: messagesFrom(t),
			presentation: isTouch.matches ? 'uikit' : 'theme'
		});
	});

	// The list's own pointer listeners, on its DOM element.
	$effect(() => controller.attachMouse());

	// The owner's options, for an object a Lab collection adapted from the
	// owner's.
	$effect(() => controller.mount(reorder.options.startedBy ?? reorder.options));

	// The List stopped reordering, or unmounted: a drag goes home.
	$effect(() => () => controller.dispose());

	// The gesture host's hold recognizer on the list. It takes a finger under
	// every primary pointer, and a pen where the primary pointer is coarse.
	$effect(() => controller.attachTouch(isTouch.matches));
</script>

<span id={controller.hintId} hidden>{t('@astryx.list.reorderHint')}</span>
<ListReorderModeHint {controller} />
