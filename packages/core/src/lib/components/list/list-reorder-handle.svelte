<script lang="ts" module>
	import type { ListReorderHandleProps } from './list-reorder-types.js';

	export type { ListReorderHandleProps };
</script>

<script lang="ts">
	import { useTranslator } from '../../i18n/use-translator.svelte.js';
	import { useList } from './list-context.svelte.js';
	import { useItemLabel } from '../item/item-label-context.svelte.js';
	import { listReorderHandleProps } from '../../private-attributes/list-reorder.js';
	import { ownRingProps } from '../../private-attributes/own-ring.stylex.js';
	import { useTouchHitArea } from '../../utils/touch-hit-area.svelte.js';
	import { warnOnce } from '../../utils/dev-warning.js';
	import { reorderHandleAttrs } from './list-reorder-handle.stylex.js';

	/**
	 * The reorder handle of a List row. Renders nothing outside a reorderable
	 * List.
	 *
	 * Ported from Astryx's `List/ListReorderHandle.tsx`. The React
	 * `useSyncExternalStore` becomes a subscription that writes `isPressed`,
	 * and the no-dependency layout/passive effects become `$effect` for the
	 * registration seams and a `subscribeCommit` effect for the accessible-name
	 * pass, which upstream re-runs on every commit because the row's place may
	 * have moved.
	 */
	let {
		label,
		itemKey,
		isDisabled = false,
		rowLabel,
		rowLabelledBy,
		rowAlign
	}: ListReorderHandleProps = $props();

	const t = useTranslator();
	const list = useList();
	const reorder = $derived(list?.()?.reorder ?? null);
	const controller = $derived(reorder?.session ?? null);
	// The row's label element, when the handle sits in an Item's slot.
	const getLabelId = useItemLabel();
	const labelID = $derived(getLabelId());
	const verbID = $props.id();

	let handleEl = $state<HTMLButtonElement | null>(null);
	let isPressed = $state(false);
	// A string label's text is known before the label renders. A snippet's is
	// read from the label element once it has rendered, as upstream's
	// `getNodeText` reads its ReactNode's text children.
	let snippetText = $state('');
	const text = $derived(
		typeof label === 'string' ? label.replace(/\s+/g, ' ').trim() : snippetText
	);

	/**
	 * The text the row's label element shows, collapsed; empty without one.
	 */
	function labelTextOf(element: HTMLElement | null, id: string | null): string {
		const labelEl = id == null ? null : (element?.ownerDocument.getElementById(id) ?? null);
		return (labelEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
	}

	/**
	 * Whether the row's label element names it: it shows text, or holds an icon
	 * or image with an accessible name of its own.
	 */
	function namesRow(element: HTMLElement | null): boolean {
		if (element == null) {
			return false;
		}
		return (
			(element.textContent ?? '').trim() !== '' ||
			element.querySelector(
				'[aria-label]:not([aria-label=""]), [aria-labelledby], img[alt]:not([alt=""])'
			) != null
		);
	}

	const callerLabel = $derived(rowLabel?.trim() || null);
	const labelledBy = $derived(
		callerLabel != null ? undefined : (rowLabelledBy ?? labelID ?? undefined)
	);
	const named = $derived(callerLabel != null || labelledBy != null || text !== '');
	const isEnabled = $derived(controller != null && !isDisabled);

	// A snippet label's text, read from the label element after it renders.
	$effect(() => {
		if (typeof label === 'string' || labelID == null) {
			return;
		}
		const next = labelTextOf(handleEl, labelID);
		if (next !== snippetText) {
			snippetText = next;
		}
	});

	// Syncs the handle into the reorder session, which lives outside Svelte.
	// The session moves the row only with its handle recorded, and reports its
	// moves with the row's key.
	$effect(() => {
		const handle = handleEl;
		if (handle == null) {
			return;
		}
		return controller?.registerHandle(handle, itemKey);
	});

	// Syncs the row's name into the session, which announces the moves with it.
	// A new name keeps the handle recorded, so its row stays in reorder mode. A
	// component label's text is read from its element, rendered by now.
	$effect(() => {
		const handle = handleEl;
		if (handle == null) {
			return;
		}
		const spoken = callerLabel ?? (text !== '' ? text : labelTextOf(handle, labelID));
		return controller?.registerName(handle, spoken);
	});

	// The row's reorder mode, as the handle's `aria-pressed`.
	$effect(() => {
		const handle = handleEl;
		if (controller == null || handle == null) {
			isPressed = false;
			return;
		}
		isPressed = controller.isInMode(handle);
		return controller.subscribeMode(() => {
			isPressed = controller.isInMode(handle);
		});
	});

	// A finger's target: the shared touch hit area grows the handle's hit layer
	// where the primary pointer is coarse.
	useTouchHitArea(
		() => handleEl,
		() => true
	);

	// A handle that stops taking gestures mid-drag sends a drag of its row home,
	// whichever pointer or key drives it. Its row may be disabled or no longer
	// reorderable, or the handle may be gone.
	$effect(() => {
		const handle = handleEl;
		if (!isEnabled || controller == null || handle == null) {
			return;
		}
		return () => controller.release(handle);
	});

	// That place is read from the DOM after each commit (the row does not know
	// its index). A passive pass: the list's own element is attached after its
	// rows' effects run.
	function syncAccessibleName(): void {
		const handle = handleEl;
		if (handle == null) {
			return;
		}
		// Named by Item's label element only while it shows a name: a label of
		// an unnamed icon alone falls back to the place.
		if (labelID != null && labelledBy === labelID) {
			if (namesRow(handle.ownerDocument.getElementById(labelID))) {
				handle.setAttribute('aria-labelledby', `${verbID} ${labelID}`);
				handle.setAttribute('aria-label', t('@astryx.list.reorderHandleVerb'));
				return;
			}
			handle.removeAttribute('aria-labelledby');
		} else if (named) {
			return;
		}
		const position = controller?.positionOf(handle) ?? null;
		if (position == null) {
			return;
		}
		// Named after its place only: a person hears "Reorder item 3" with
		// nothing to tell the rows apart. Development says so, once a handle.
		warnOnce(
			'List:reorderable-row-name',
			'ListItem',
			'A reorderable row has no accessible name, so its reorder handle is ' +
				'named after its place ("Reorder item N"). Give the row a text ' +
				'label or an aria-label.'
		);
		handle.setAttribute('aria-label', t('@astryx.list.reorderHandleAt', { position }));
	}

	// The pass runs when its inputs change and after every commit, when the
	// row's place may have moved.
	$effect(() => {
		syncAccessibleName();
	});
	$effect(() => controller?.subscribeCommit(syncAccessibleName));

	// Named through the label element. The handle's own `aria-label` is the
	// verb. It lists itself first in its `aria-labelledby`, which reads its
	// `aria-label` there: "Reorder", then the row's label.
	const name = $derived(
		callerLabel != null
			? t('@astryx.list.reorderHandle', { label: callerLabel })
			: labelledBy != null
				? t('@astryx.list.reorderHandleVerb')
				: text !== ''
					? t('@astryx.list.reorderHandle', { label: text })
					: undefined
	);

	const attrs = $derived(reorderHandleAttrs({ rowAlign }));
</script>

{#if controller != null}
	<button
		bind:this={handleEl}
		id={labelledBy == null ? undefined : verbID}
		type="button"
		{...listReorderHandleProps}
		{...ownRingProps}
		data-astryx-pressable=""
		aria-label={name}
		aria-labelledby={labelledBy == null ? undefined : `${verbID} ${labelledBy}`}
		aria-describedby={controller.hintId}
		aria-disabled={isDisabled || undefined}
		aria-pressed={isPressed}
		onclick={() => {
			// A click, Space or Enter: reorder mode, unless the press dragged.
			if (!controller.takeDrag(handleEl) && !isDisabled) {
				controller.toggleMode(handleEl);
			}
		}}
		onkeydown={(event) => {
			if (!isDisabled) {
				controller.keyDown(handleEl, event);
			}
		}}
		onblur={(event) => controller.blur(handleEl, event.relatedTarget)}
		onpointerdown={(event) => event.stopPropagation()}
		ontouchstart={(event) => event.stopPropagation()}
		oncontextmenu={(event) => {
			if ((event as MouseEvent & { pointerType?: string }).pointerType === 'touch') {
				event.preventDefault();
				event.stopPropagation();
			}
		}}
		class={attrs.class}
		style={attrs.style}
	></button>
{/if}
