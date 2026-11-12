<script lang="ts" module>
	export interface SelectionStateProbeItem extends Record<string, unknown> {
		id: string;
		name: string;
	}

	/** Upstream's `testData`, reduced to the fields this probe reads. */
	export const PROBE_DATA: SelectionStateProbeItem[] = [
		{ id: '1', name: 'Alice' },
		{ id: '2', name: 'Bob' },
		{ id: '3', name: 'Charlie' },
		{ id: '4', name: 'Diana' }
	];
</script>

<script lang="ts">
	import {
		useTableSelectionState,
		type TableSelectionState
	} from '$lib/components/table/plugins/selection/use-table-selection-state.svelte.js';

	/**
	 * The port's substitute for upstream's `renderHook` case in
	 * `useTableSelectionState.test.tsx`: `api` exposes the hook's return value
	 * through `render(...).component`, and the two testids make a later
	 * selection change observable without reaching into Svelte internals.
	 *
	 * The setter forwards to the caller's spy before assigning, so the clear
	 * case can assert the exact `Set` upstream asserts while the fixture's own
	 * state still updates for the live-member case.
	 */
	interface Props {
		initialSelected?: ReadonlySet<string>;
		onSetSelectedKeys?: (next: Set<string>) => void;
	}

	const { initialSelected = new Set<string>(), onSetSelectedKeys }: Props = $props();

	// svelte-ignore state_referenced_locally
	let selectedKeys = $state(new Set<string>(initialSelected));

	const { selectionState } = useTableSelectionState<SelectionStateProbeItem>(() => ({
		data: PROBE_DATA,
		idKey: 'id',
		selectedKeys,
		setSelectedKeys: (next) => {
			onSetSelectedKeys?.(next);
			selectedKeys = next;
		}
	}));

	export const api = {
		get selectionState(): TableSelectionState {
			return selectionState;
		}
	};
</script>

<span data-testid="selected-count">{selectionState.selectedCount}</span>
<span data-testid="has-selection">{String(selectionState.hasSelection)}</span>
