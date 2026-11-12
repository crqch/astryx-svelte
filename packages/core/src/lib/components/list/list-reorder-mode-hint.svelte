<script lang="ts" module>
	import type { ListReorderController } from './list-reorder-engine.js';

	export interface ListReorderModeHintProps {
		controller: ListReorderController;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import Kbd from '../kbd/kbd.svelte';
	import Layer from '../layer/layer.svelte';
	import { useLayer } from '../layer/use-layer.svelte.js';
	import { useLayerDismissal } from '../layer/use-layer-dismissal.svelte.js';
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { anchoredHintStyles } from '../../hooks/anchored-hint.stylex.js';
	import { sx } from '../../internal/sx.js';
	import ListReorderHintButton from './list-reorder-hint-button.svelte';

	/**
	 * Reorder mode's hint. It is anchored below the start of the handle whose
	 * row is in the mode, in the anchored hint's layer and theme roles. It
	 * shows the moves for the list's axis and Done until the mode ends. Each
	 * move is a button that does what its key does, with the same announcement,
	 * and the focus stays on the handle. Done ends the mode as Escape does. So
	 * a pointer or a finger can reorder by tapping the handle, the moves, then
	 * Done.
	 *
	 * Ported from Astryx's `ListReorderModeHint`. `useSyncExternalStore` becomes
	 * a `$state` subscription; `layer.ref(target)` is `attachTrigger`, whose
	 * detach is kept as the effect's cleanup.
	 */
	let { controller }: ListReorderModeHintProps = $props();

	const t = useTranslator();
	const id = $props.id();
	const layer = useLayer(() => ({ mode: 'context', id }));
	let target = $state<HTMLElement | null>(null);
	let hintEl = $state<HTMLElement | null>(null);

	$effect(() => {
		target = controller.modeTarget;
		return controller.subscribeMode(() => {
			target = controller.modeTarget;
		});
	});

	// External system: the hint's popover in the top layer (useLayer), anchored
	// to the handle of the row in reorder mode. Shown while that row is in the
	// mode; hidden and unanchored when the mode ends or moves on.
	$effect(() => {
		const anchor = target;
		if (anchor == null) {
			// `hide` reads and writes the layer's `isOpen` state; untracked, so
			// this effect is not subscribed to its own write.
			untrack(() => layer.hide());
			return;
		}
		const detach = untrack(() => layer.attachTrigger(anchor)) ?? null;
		untrack(() => layer.show());
		return () => {
			untrack(() => layer.hide());
			detach?.();
		};
	});

	// The shared dismissal stack. While the hint is up, an Escape that reaches
	// the stack, with the focus in the hint, ends reorder mode. A layer below
	// it, such as a Dialog, stays open. The handle claims its own Escape first.
	useLayerDismissal(() => ({
		isActive: target != null,
		onDismiss: () => controller.endMode(),
		getContainer: () => hintEl
	}));

	// Records the hint's element so focus inside it keeps the mode and an
	// Escape that reaches the stack can be routed to this layer.
	$effect(() => {
		controller.setHintElement(hintEl);
		return () => controller.setHintElement(null);
	});

	const keysAttrs = sx(anchoredHintStyles.keys);
</script>

<Layer
	{layer}
	placement="below"
	alignment="start"
	xstyle={[anchoredHintStyles.hint]}
	style="margin-block-start: var(--spacing-2)"
>
	<span bind:this={hintEl} class={keysAttrs.class} style={keysAttrs.style}>
		<ListReorderHintButton
			label={t('@astryx.list.reorderMoveUp')}
			onPress={() => controller.step(target, -1)}
		>
			<Kbd keys="up" aria-hidden />
		</ListReorderHintButton>
		<ListReorderHintButton
			label={t('@astryx.list.reorderMoveDown')}
			onPress={() => controller.step(target, 1)}
		>
			<Kbd keys="down" aria-hidden />
		</ListReorderHintButton>
		<ListReorderHintButton isText onPress={() => controller.endMode()}>
			{t('@astryx.list.reorderDone')}
		</ListReorderHintButton>
	</span>
</Layer>
