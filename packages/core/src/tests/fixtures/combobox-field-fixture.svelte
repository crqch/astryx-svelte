<script lang="ts" module>
	export interface ComboboxPerson {
		value: string;
		label: string;
		disabled?: boolean;
	}
</script>

<script lang="ts">
	import { useCombobox } from '$lib/components/selector/use-combobox.svelte.js';

	/**
	 * Upstream's `Picker`: a field the test renders itself, with its list in the
	 * page's flow. A Svelte component because the hook returns props, and only a
	 * template can spread them onto the field, listbox and options.
	 */
	interface Props {
		options?: ComboboxPerson[];
		isInitiallyOpen?: boolean;
		onSelect?: (value: string) => void;
		onOpen?: () => void;
		onClose?: () => void;
		onFieldKeyDown?: (event: KeyboardEvent) => void;
	}

	const {
		options = [
			{ value: 'ada', label: 'Ada' },
			{ value: 'bea', label: 'Bea', disabled: true },
			{ value: 'cy', label: 'Cy' }
		],
		isInitiallyOpen = true,
		onSelect,
		onOpen,
		onClose,
		onFieldKeyDown
	}: Props = $props();

	let isOpen = $state(isInitiallyOpen);

	const combobox = useCombobox(() => ({
		selectableItems: options,
		isOpen,
		onOpen: () => {
			onOpen?.();
			isOpen = true;
		},
		onClose: () => {
			onClose?.();
			isOpen = false;
		},
		onSelect,
		listboxId: 'people'
	}));

	const fieldProps = $derived(combobox.getFieldProps({ onKeyDown: onFieldKeyDown }));
	const listboxProps = $derived(combobox.getListboxProps());
</script>

<input aria-label="To" {...fieldProps} />
{#if isOpen && options.length > 0}
	<div aria-label="People" {...listboxProps}>
		{#each options as person, index (person.value)}
			<div {...combobox.getOptionProps(index)}>{person.label}</div>
		{/each}
	</div>
{/if}
