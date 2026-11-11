<script lang="ts">
	import { useCombobox } from '$lib/components/selector/use-combobox.svelte.js';

	/**
	 * Upstream's `Trigger`: the hook's trigger model, carried by a bare button
	 * rather than a field. The last case asserts this model did not move when the
	 * field model was added.
	 */
	const people = [
		{ value: 'ada', label: 'Ada' },
		{ value: 'bea', label: 'Bea', disabled: true },
		{ value: 'cy', label: 'Cy' }
	];

	let isOpen = $state(true);

	const combobox = useCombobox(() => ({
		selectableItems: people,
		isOpen,
		onOpen: () => {
			isOpen = true;
		},
		onClose: () => {
			isOpen = false;
		},
		listboxId: 'trigger'
	}));
</script>

<button
	type="button"
	aria-activedescendant={combobox.highlightedIndex >= 0
		? combobox.getItemId(combobox.highlightedIndex)
		: undefined}
	onkeydown={combobox.onKeyDown}
>
	Pick
</button>
