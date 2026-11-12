/** PORTS: motion/animatedLayoutAdopters.test.tsx */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { TreeListItemData } from '$lib/components/tree-list/tree-list-types.js';
import AdopterArea from './fixtures/animated-layout-adopter-area.svelte';
import HookProbe from './fixtures/animated-layout-hook-probe.svelte';

/**
 * Astryx's `motion/animatedLayoutAdopters.test.tsx`, ported case for case.
 *
 * The component-adoption declarations run in real Chromium, so layout is real
 * where upstream's jsdom needs `getBoundingClientRect` stubs. This file keeps
 * the stubs anyway, for the same reason upstream has them: a case asserts
 * *which* element glided and when, and the stub's before/after pair is a
 * deterministic way to make one element move while the rest of the page lays
 * out normally. The two calls `stubGeometry` makes are the walk's read before
 * the commit and the flush's read after it.
 *
 * Translations, each noted at its case:
 * - `measures once in StrictMode, and not at all for a change that never
 *   lands` keeps its second half only. React's StrictMode replays a render
 *   React then throws away, which `getSnapshotBeforeUpdate` never sees; Svelte
 *   commits every rerender, so there is no discarded render in which a
 *   measurement could run twice. The owner-refuses-the-toggle half — no
 *   measurement and no animation for a change that never lands — is ported.
 * - `act(() => finishes.get(...)?.())` becomes calling the recorded finish
 *   listener, then a microtask flush: Svelte has no `act`, and its DOM update
 *   is applied in the flush the state write schedules.
 * - The chevron is found through `:scope > .astryx-icon`, the Icon's own
 *   element carrying the `astryx-icon` target, exactly as upstream's query.
 */

let animated: Element[] = [];
/** Each animation's finish listener, by the element it plays on. */
let finishes = new Map<Element, () => void>();
const originalAnimate = Element.prototype.animate;
const originalMatchMedia = window.matchMedia;

/** Records an animation on `target` and keeps its finish listener. */
function recordAnimation(target: Element): Animation {
	animated.push(target);
	return {
		cancel() {},
		addEventListener(type: string, listener: () => void) {
			if (type === 'finish') {
				finishes.set(target, listener);
			}
		},
		// A change retargeting a running glide reads it 100 ms in.
		currentTime: 100
	} as unknown as Animation;
}

beforeEach(() => {
	animated = [];
	finishes = new Map();
	Element.prototype.animate = function animate(this: Element) {
		return recordAnimation(this);
	};
});

afterEach(() => {
	Element.prototype.animate = originalAnimate;
	window.matchMedia = originalMatchMedia;
	vi.restoreAllMocks();
});

const flush = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

/**
 * A container with the component under test and a following paragraph that
 * sits 80 px lower once anything has been measured (the real page lays out;
 * jsdom's stub stands in for a change the case names).
 */
function stubGeometry(): HTMLElement {
	const area = document.querySelector('[data-testid="area"]') as HTMLElement;
	const after = document.querySelector('[data-testid="after"]') as HTMLElement;
	vi.spyOn(area, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 600));
	let reads = 0;
	vi.spyOn(after, 'getBoundingClientRect').mockImplementation(() => {
		reads += 1;
		// The first read is the measurement before the change commits.
		return new DOMRect(0, reads === 1 ? 40 : 120, 400, 20);
	});
	return after;
}

const treeItems: TreeListItemData[] = [
	{
		id: 'src',
		label: 'src',
		children: [{ id: 'index', label: 'index.ts' }]
	}
];

function toggleOf(): HTMLElement {
	return document.querySelector<HTMLElement>('[data-tree-toggle]') ?? document.body;
}

function collapsibleChevron(): HTMLElement | null {
	return (
		document
			.querySelector<HTMLElement>('button[aria-controls]')
			?.querySelector<HTMLElement>(':scope > .astryx-icon') ?? null
	);
}

function treeChevron(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-tree-toggle] > .astryx-icon');
}

describe('useAnimatedLayout', () => {
	it('returns the same member-free handle on every render', async () => {
		// Svelte has no render function to rerun: the handle is created at
		// initialisation, so a rerender by definition keeps it.
		const screen = await render(HookProbe);
		const first = screen.component.getLayout();
		expect(Object.keys(first)).toEqual([]);
		await screen.rerender({});
		expect(screen.component.getLayout()).toBe(first);
	});
});

describe.each([
	{
		name: 'Collapsible',
		kind: 'collapsible' as const,
		toggle: () => document.querySelector<HTMLElement>('button[aria-controls]') ?? document.body,
		chevron: collapsibleChevron
	},
	{
		name: 'TreeList',
		kind: 'tree' as const,
		toggle: toggleOf,
		chevron: treeChevron
	}
])('$name adopts animatedLayout (spec:AST-105 FR1, FR2)', (component) => {
	it('glides the content after it inside the container with a handle', async () => {
		await render(AdopterArea, {
			props: { kind: component.kind, withHandle: true, items: treeItems }
		});
		const after = stubGeometry();
		await userEvent.click(component.toggle());
		await flush();
		expect(animated).toContain(after);
		expect(component.chevron()?.style.getPropertyValue('transition-timing-function')).toBe(
			'cubic-bezier(0.24, 1, 0.4, 1)'
		);
	});

	it('changes nothing without a handle', async () => {
		await render(AdopterArea, {
			props: { kind: component.kind, withHandle: false, items: treeItems }
		});
		stubGeometry();
		await userEvent.click(component.toggle());
		await flush();
		expect(animated).toEqual([]);
		expect(component.chevron()?.style.getPropertyValue('transition-duration')).toBe('');
	});
});

describe('a TreeList under a finger with no handle (component:TreeList FR8)', () => {
	function stubPointer(isCoarse: boolean) {
		window.matchMedia = ((query: string) => ({
			matches: isCoarse && query.includes('coarse'),
			media: query,
			onchange: null,
			addEventListener() {},
			removeEventListener() {},
			addListener() {},
			removeListener() {},
			dispatchEvent: () => false
		})) as unknown as typeof window.matchMedia;
	}

	const pointerItems: TreeListItemData[] = [
		{
			id: 'src',
			label: 'src',
			children: [{ id: 'index', label: 'index.ts' }]
		},
		{ id: 'readme', label: 'README.md' }
	];

	/** The row after the folder and the content after the tree each sit 80 px lower once measured. */
	function stubTreeGeometry() {
		const tree = document.querySelector('[role="tree"]') as HTMLElement;
		vi.spyOn(tree, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 600));
		const below = document.querySelector<HTMLElement>('[data-tree-id="readme"]') ?? document.body;
		const after = document.querySelector('[data-testid="after"]') as HTMLElement;
		for (const element of [below, after]) {
			let reads = 0;
			vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
				reads += 1;
				return new DOMRect(0, reads === 1 ? 40 : 120, 400, 20);
			});
		}
		return { below, after };
	}

	it('glides the rows after a toggled row inside the tree, and leaves the content after the tree in place', async () => {
		stubPointer(true);
		await render(AdopterArea, {
			props: { kind: 'tree', withHandle: false, items: pointerItems }
		});
		const { below, after } = stubTreeGeometry();
		await userEvent.click(toggleOf());
		await flush();
		expect(animated).toContain(below);
		expect(animated).not.toContain(after);
	});

	it('clips the bottom edge of the tree while its own motion runs, and not at rest', async () => {
		stubPointer(true);
		await render(AdopterArea, {
			props: { kind: 'tree', withHandle: false, items: pointerItems }
		});
		stubTreeGeometry();
		const tree = document.querySelector('[role="tree"]') as HTMLElement;
		let settle = () => {};
		const motion = {
			playState: 'running',
			effect: { getComputedTiming: () => ({ endTime: 300 }) },
			finished: new Promise<void>((resolve) => {
				settle = resolve;
			})
		} as unknown as Animation;
		tree.getAnimations = () => [motion];
		await userEvent.click(toggleOf());
		await flush();
		expect(tree.style.clipPath).toMatch(/^inset\(-100vmax -100vmax calc/);
		settle();
		await flush();
		expect(tree.style.clipPath).toBe('');
	});

	it('changes nothing under a mouse', async () => {
		stubPointer(false);
		await render(AdopterArea, {
			props: { kind: 'tree', withHandle: false, items: pointerItems }
		});
		stubTreeGeometry();
		await userEvent.click(toggleOf());
		await flush();
		expect(animated).toEqual([]);
		expect((document.querySelector('[role="tree"]') as HTMLElement).style.clipPath).toBe('');
	});
});

describe('Collapsible changes another component made (spec:AST-105 FR3)', () => {
	it('glides the items between when a single-mode group closes one item to open another', async () => {
		const screen = await render(AdopterArea, {
			props: { kind: 'group', withHandle: true }
		});
		stubGeometry();
		// The Payment item sits between the one that closes and the one that
		// opens: it moves up when Shipping closes.
		const payment = (
			screen.getByRole('button', { name: 'Payment', exact: true }).element() as HTMLElement
		).closest<HTMLElement>('.astryx-collapsible');
		expect(payment).not.toBeNull();
		let reads = 0;
		vi.spyOn(payment as HTMLElement, 'getBoundingClientRect').mockImplementation(() => {
			reads += 1;
			return new DOMRect(0, reads === 1 ? 140 : 40, 400, 40);
		});
		await userEvent.click(screen.getByRole('button', { name: 'Warranty', exact: true }));
		await flush();
		expect(animated).toContain(payment);
	});

	it('glides an owner-set isOpen too (spec:AST-105 FR1: each change is reported)', async () => {
		const props = {
			kind: 'collapsible' as const,
			withHandle: true,
			isOpen: false,
			onOpenChange: () => {}
		};
		const screen = await render(AdopterArea, { props });
		const after = stubGeometry();
		await screen.rerender({ ...props, isOpen: true });
		await flush();
		expect(animated).toContain(after);
	});

	it("glides a group's controlled value change", async () => {
		const props = {
			kind: 'group' as const,
			withHandle: true,
			groupVariant: 'pair' as const,
			groupValue: 'one'
		};
		const screen = await render(AdopterArea, { props });
		const after = stubGeometry();
		await screen.rerender({ ...props, groupValue: 'two' });
		await flush();
		expect(animated).toContain(after);
	});

	it('glides a TreeList row whose isExpanded changed in items', async () => {
		const tree = (isExpanded: boolean) => [
			{
				id: 'src',
				label: 'src',
				isExpanded,
				children: [{ id: 'index', label: 'index.ts' }]
			}
		];
		const screen = await render(AdopterArea, {
			props: { kind: 'tree', withHandle: true, items: tree(false) }
		});
		const after = stubGeometry();
		await screen.rerender({ kind: 'tree', withHandle: true, items: tree(true) });
		await flush();
		expect(animated).toContain(after);
	});

	it('measures nothing for a change that never lands', async () => {
		// Svelte has no StrictMode replay — every rerender commits — so the
		// upstream case's "measures once under StrictMode" half has no
		// counterpart. Its other half does: an owner that refuses every toggle
		// changes nothing, so nothing is measured and no batch is left behind.
		const screen = await render(AdopterArea, {
			props: {
				kind: 'collapsible',
				withHandle: true,
				isOpen: false,
				onOpenChange: () => {}
			}
		});
		const after = document.querySelector('[data-testid="after"]') as HTMLElement;
		const reads = vi.spyOn(after, 'getBoundingClientRect');
		await userEvent.click(screen.getByRole('button', { name: 'Details', exact: true }));
		await flush();
		expect(reads).not.toHaveBeenCalled();
		expect(animated).toEqual([]);
	});
});

describe("a close plays the content's exit (spec:AST-105 FR4)", () => {
	it("keeps a closing Collapsible's content rendered, inert and out of flow until its exit ends", async () => {
		const screen = await render(AdopterArea, {
			props: { kind: 'collapsible', withHandle: true, defaultIsOpen: true }
		});
		stubGeometry();
		const trigger = screen
			.getByRole('button', { name: 'Details', exact: true })
			.element() as HTMLElement;
		const content = document.getElementById(
			trigger.getAttribute('aria-controls') ?? ''
		) as HTMLElement;
		vi.spyOn(content, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 40, 400, 40));
		await userEvent.click(trigger);
		await flush();
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		// Still on screen for the exit, out of reach, giving up its space.
		expect(getComputedStyle(content).display).not.toBe('none');
		expect(content).toHaveAttribute('inert');
		expect(content.style.getPropertyValue('margin-block-end')).not.toBe('');
		expect(animated).toContain(document.querySelector('[data-testid="after"]'));
		finishes.get(content)?.();
		await flush();
		expect(getComputedStyle(content).display).toBe('none');
		expect(content).not.toHaveAttribute('inert');
		expect(content.style.getPropertyValue('margin-block-end')).toBe('');
	});

	it('moves focus inside a closing Collapsible to its trigger while the content plays its exit (component:Collapsible AR4)', async () => {
		const example = (isOpen: boolean) => ({
			kind: 'collapsible' as const,
			withHandle: true,
			isOpen,
			onOpenChange: () => {},
			childKind: 'button' as const
		});
		const screen = await render(AdopterArea, { props: example(true) });
		stubGeometry();
		const trigger = document.querySelector<HTMLElement>('button[aria-controls]') as HTMLElement;
		const content = document.getElementById(
			trigger.getAttribute('aria-controls') ?? ''
		) as HTMLElement;
		vi.spyOn(content, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 40, 400, 40));
		(screen.getByRole('button', { name: 'Inside', exact: true }).element() as HTMLElement).focus();
		await screen.rerender(example(false));
		await flush();
		// Still on screen for the exit, and inert, so focus left it.
		expect(content).toHaveAttribute('inert');
		expect(document.activeElement).toBe(trigger);
	});

	it("keeps a collapsing TreeList row's child group until its exit ends, out of the keyboard order", async () => {
		await render(AdopterArea, {
			props: {
				kind: 'tree',
				withHandle: true,
				items: [
					{
						id: 'src',
						label: 'src',
						isExpanded: true,
						children: [{ id: 'index', label: 'index.ts' }]
					}
				]
			}
		});
		stubGeometry();
		const groupOf = () =>
			document.querySelector<HTMLElement>('[data-tree-id="src"] > [role="group"]');
		vi.spyOn(groupOf() as HTMLElement, 'getBoundingClientRect').mockReturnValue(
			new DOMRect(0, 40, 400, 40)
		);
		await userEvent.click(toggleOf());
		await flush();
		const group = groupOf();
		expect(group).not.toBeNull();
		expect(group).toHaveAttribute('inert');
		expect(group?.style.getPropertyValue('margin-block-end')).not.toBe('');
		// The tree's keyboard order (the rows its focus model reaches) has only
		// the collapsed row.
		expect(document.querySelectorAll('[role="treeitem"]:not([data-tree-exiting] *)')).toHaveLength(
			1
		);
		finishes.get(group as HTMLElement)?.();
		await flush();
		expect(groupOf()).toBeNull();
	});

	it('moves focus inside a collapsing TreeList branch to its row while the group plays its exit (component:TreeList AR2)', async () => {
		const example = (isExpanded: boolean) => ({
			kind: 'tree' as const,
			withHandle: true,
			items: [
				{
					id: 'src',
					label: 'src',
					isExpanded,
					children: [{ id: 'index', label: 'index.ts' }]
				}
			]
		});
		const screen = await render(AdopterArea, { props: example(true) });
		stubGeometry();
		const groupOf = () =>
			document.querySelector<HTMLElement>('[data-tree-id="src"] > [role="group"]');
		vi.spyOn(groupOf() as HTMLElement, 'getBoundingClientRect').mockReturnValue(
			new DOMRect(0, 40, 400, 40)
		);
		document.querySelector<HTMLElement>('[data-tree-id="index"]')?.focus();
		await screen.rerender(example(false));
		await flush();
		// The group is still there for its exit, inert, so focus left it.
		expect(groupOf()).toHaveAttribute('inert');
		expect(document.activeElement).toBe(document.querySelector('[data-tree-id="src"]'));
	});

	it('collapses a row with an expanded child as one change: only the outer group exits, and the child goes with it', async () => {
		await render(AdopterArea, {
			props: {
				kind: 'tree',
				withHandle: true,
				items: [
					{
						id: 'photos',
						label: 'Photos',
						isExpanded: true,
						children: [
							{
								id: 'trips',
								label: 'Trips',
								isExpanded: true,
								children: [{ id: 'snow', label: 'Snow.jpg' }]
							}
						]
					}
				]
			}
		});
		stubGeometry();
		const groupOf = (id: string) =>
			document.querySelector<HTMLElement>(`[data-tree-id="${id}"] > [role="group"]`);
		vi.spyOn(groupOf('photos') as HTMLElement, 'getBoundingClientRect').mockReturnValue(
			new DOMRect(0, 40, 400, 80)
		);
		await userEvent.click(
			document.querySelector<HTMLElement>('[data-tree-id="photos"] > div [data-tree-toggle]') ??
				document.body
		);
		await flush();
		const outer = groupOf('photos');
		// Only the outer group is held; the child's group stays inside it as it
		// was, so the content after them moves once.
		expect(outer?.style.getPropertyValue('margin-block-end')).not.toBe('');
		expect(groupOf('trips')?.style.getPropertyValue('margin-block-end')).toBe('');
		finishes.get(outer as HTMLElement)?.();
		await flush();
		expect(groupOf('photos')).toBeNull();
	});

	it("drops the chevron's move curve when the handle is removed", async () => {
		const screen = await render(AdopterArea, {
			props: { kind: 'collapsible', withHandle: true }
		});
		await userEvent.click(screen.getByRole('button', { name: 'Details', exact: true }));
		const chevron = collapsibleChevron();
		expect(chevron?.style.getPropertyValue('transition-duration')).not.toBe('');
		await screen.rerender({ kind: 'collapsible', withHandle: false });
		await flush();
		expect(chevron?.style.getPropertyValue('transition-duration')).toBe('');
	});

	it('lands a close at once without a handle', async () => {
		const screen = await render(AdopterArea, {
			props: { kind: 'collapsible', withHandle: false, defaultIsOpen: true }
		});
		const trigger = screen
			.getByRole('button', { name: 'Details', exact: true })
			.element() as HTMLElement;
		await userEvent.click(trigger);
		await flush();
		const content = document.getElementById(
			trigger.getAttribute('aria-controls') ?? ''
		) as HTMLElement;
		expect(getComputedStyle(content).display).toBe('none');
		expect(content).not.toHaveAttribute('inert');
	});
});
