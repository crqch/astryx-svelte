/** PORTS: Resizable/useResizable.test.ts */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { endResizeAt } from '$lib/components/resizable/use-resizable.svelte.js';
import { isResizeObserved } from '$lib/internal/shared-resize-observer.js';
import type {
	ResizableProps,
	ResizableRegion,
	UseResizableSingleConfig
} from '$lib/components/resizable/use-resizable.svelte.js';
import { percent, pixel } from '$lib/components/resizable/use-resizable.svelte.js';
import Probe from './fixtures/use-resizable-probe.svelte';
import MultiProbe from './fixtures/use-resizable-multi-probe.svelte';

/**
 * Astryx's `Resizable/useResizable.test.ts`, ported at the **0.7.13** pin.
 *
 * ## Harness translations
 *
 * - `renderHook(() => useResizable(config))` becomes a probe component that
 *   runs the hook in its init; `render(...).component.current()` is
 *   `result.current`. A config change is a prop rerender, and `version` is read
 *   inside the config getter so a test can make an otherwise identical config
 *   reach the hook (React reruns the hook regardless of prop identity).
 * - `act()` has no counterpart: a `$state` write flushes on its own. Reads of
 *   the region's getters are synchronous; rendered output is awaited with
 *   `tick()`.
 * - jsdom stubs for layout become real Chromium layout. A percentage container
 *   is a real element with an explicit pixel width and height, appended to the
 *   document. `content` / `contentBlock` therefore change its style, and the
 *   shared `ResizeObserver` delivers the new content box; the cases await the
 *   region's new size with `vi.waitFor`.
 * - `window.innerWidth = 1000` becomes an accessor spy: Chromium's property is
 *   read-only, and the hook reads it through the same accessor.
 * - The `ResizeObserver` counting class is jsdom-only internal observation
 *   evidence; the browser harness cannot substitute the real shared observer
 *   without breaking later cases. The behaviour those cases assert is ported,
 *   the observer-identity assertion is named where it cannot be.
 *
 * ## Cases not ported, and why
 *
 * - `settles a pixel-only mount without a ref in one render pass` — React's
 *   render-pass count. Svelte has no render pass to count; the claim that the
 *   mount settles where it starts is covered by the persistence cases.
 * - `settles %i numeric-only mounts with containerRef in one pass each` — the
 *   same React render-pass and `ResizeObserver`-constructor counters; the
 *   browser project only has a real observer.
 * - `uses the deterministic 1200px server basis` and `hydrates a container
 *   default without persisting the temporary basis` — ported in the companion
 *   `use-resizable-hydration.svelte.test.ts`, which has the SSR render harness.
 * - `matches an atomic percentage default render count and drops both
 *   observers` — React render counts and observer identity, as above.
 * - `resolves a percentage default against its container once measured, after
 *   an <Activity> hid and showed the region before then` — React `<Activity>`.
 * - `reads the window width/height again only during render, not after the
 *   commit` — React's `useSyncExternalStore` post-commit snapshot read. Svelte
 *   has no post-commit read to suppress.
 * - `rejects unsupported bound strings and removed pixel aliases` — the type
 *   half cannot compile here: this port's released API and its docs, cli and
 *   templates still use `minSizePx` / `maxSizePx`, so the aliases are kept.
 *   Upstream removed them in 0.6; that divergence is reported.
 */

const AUTO_SAVE_ID = 'test-panel';
const KEY = `astryx-resizable:${AUTO_SAVE_ID}`;

const BASE_CONFIG = {
	defaultSize: 260,
	minSize: 180,
	maxSize: 480,
	autoSaveId: AUTO_SAVE_ID
} satisfies UseResizableSingleConfig;

type StoredEntry = { size: number; isCollapsed: boolean } | number | null;

function readStored(): StoredEntry {
	return JSON.parse(localStorage.getItem(KEY) ?? 'null') as StoredEntry;
}

const containers: HTMLElement[] = [];

/** A real container with a content box of `width` × `height` px. */
function makeContainer(width = 400, height = 300): HTMLElement {
	const element = document.createElement('div');
	element.style.cssText = `width:${width}px;height:${height}px;flex:none;`;
	document.body.appendChild(element);
	containers.push(element);
	return element;
}

function setContainerWidth(element: HTMLElement, width: number): void {
	element.style.width = `${width}px`;
}

/** Waits for the shared ResizeObserver's delivery, which lands on a frame. */
async function settleResizeObserver(): Promise<void> {
	await new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
	);
}

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	vi.restoreAllMocks();
	while (containers.length > 0) {
		containers.pop()?.remove();
	}
});

type ProbeProps = {
	config: UseResizableSingleConfig;
	version?: number;
	containerRef?: { readonly current: HTMLElement | null };
	collapseOnUpdate?: boolean;
};

async function mountRegion(
	config: UseResizableSingleConfig,
	props: Omit<ProbeProps, 'config'> = {}
) {
	const screen = await render(Probe, { props: { config, ...props } });
	return { screen, region: (): ResizableRegion => screen.component.current() };
}

describe('useResizable persistence', () => {
	it('restores a persisted width (legacy plain-number format)', async () => {
		localStorage.setItem(KEY, '320');
		const { region } = await mountRegion({ ...BASE_CONFIG, collapsible: true });
		expect(region().size).toBe(320);
		expect(region().isCollapsed).toBe(false);
	});

	it('clamps a persisted width below the minimum', async () => {
		localStorage.setItem(KEY, '20');
		const { region } = await mountRegion(BASE_CONFIG);
		expect(region().size).toBe(180);
	});

	it('ignores a non-finite persisted value', async () => {
		// JSON.parse('1e999') yields Infinity, which passes a typeof check.
		localStorage.setItem(KEY, '1e999');
		const { region } = await mountRegion(BASE_CONFIG);
		expect(region().size).toBe(260);
	});

	it('ignores corrupt storage content', async () => {
		localStorage.setItem(KEY, 'not json');
		const { region } = await mountRegion(BASE_CONFIG);
		expect(region().size).toBe(260);
	});

	it('persists the expanded size together with the collapse flag', async () => {
		const { region } = await mountRegion({ ...BASE_CONFIG, collapsible: true });
		region().resize(340);
		expect(readStored()).toEqual({ size: 340, isCollapsed: false });
	});

	it('keeps the expanded width in storage when collapsing', async () => {
		const { region } = await mountRegion({ ...BASE_CONFIG, collapsible: true });
		region().resize(300);
		region().collapse();

		expect(region().size).toBe(0);
		expect(region().isCollapsed).toBe(true);
		expect(readStored()).toEqual({ size: 300, isCollapsed: true });
	});

	it('restores the collapsed state and the pre-collapse width on remount', async () => {
		localStorage.setItem(KEY, JSON.stringify({ size: 300, isCollapsed: true }));
		const { region } = await mountRegion({ ...BASE_CONFIG, collapsible: true });

		expect(region().isCollapsed).toBe(true);
		expect(region().size).toBe(0);

		region().expand();
		expect(region().size).toBe(300);
		expect(readStored()).toEqual({ size: 300, isCollapsed: false });
	});

	it('treats a legacy persisted 0 as collapsed when collapsible', async () => {
		localStorage.setItem(KEY, '0');
		const { region } = await mountRegion({ ...BASE_CONFIG, collapsible: true });

		expect(region().isCollapsed).toBe(true);
		expect(region().size).toBe(0);

		// The legacy entry lost the real width, so expanding falls back to the
		// default rather than to the minimum.
		region().expand();
		expect(region().size).toBe(260);
	});

	it('treats a legacy persisted 0 as the default width when not collapsible', async () => {
		localStorage.setItem(KEY, '0');
		const { region } = await mountRegion(BASE_CONFIG);
		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(260);
	});

	it('ignores a persisted collapse flag when not collapsible', async () => {
		localStorage.setItem(KEY, JSON.stringify({ size: 300, isCollapsed: true }));
		const { region } = await mountRegion(BASE_CONFIG);
		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(300);
	});

	it('keeps the saved width across repeated collapse calls', async () => {
		const { region } = await mountRegion({ ...BASE_CONFIG, collapsible: true });
		region().resize(300);
		region().collapse();
		region().collapse();

		expect(readStored()).toEqual({ size: 300, isCollapsed: true });
		region().expand();
		expect(region().size).toBe(300);
	});

	it('persists the pre-drag width when dragging to collapse', async () => {
		const { region } = await mountRegion({ ...BASE_CONFIG, collapsible: true });
		region().resize(300);
		region().props._onResizeStart();
		region().props._onResizeMove(-270);
		// The lift decides the close; a drag below the threshold must not
		// clobber the saved width either.
		expect(region().isCollapsed).toBe(false);
		region().props._onResizeMove(-275);
		region().props._onResizeEnd();
		expect(region().isCollapsed).toBe(true);
		expect(readStored()).toEqual({ size: 300, isCollapsed: true });

		region().expand();
		expect(region().size).toBe(300);
	});

	it.each([
		['_onResizeEnd', (p: ResizableProps) => p._onResizeEnd()],
		['_onResizeCancel', (p: ResizableProps) => p._onResizeCancel?.()]
	])('writes the size a drag reached once, after %s releases it', async (_name, finish) => {
		const { region } = await mountRegion(BASE_CONFIG);
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		try {
			region().props._onResizeStart();
			region().props._onResizeMove(20);
			region().props._onResizeMove(40);
			expect(region().size).toBe(300);
			expect(setItem).not.toHaveBeenCalled();

			finish(region().props);
			expect(setItem.mock.calls).toEqual([
				[KEY, JSON.stringify({ size: 300, isCollapsed: false })]
			]);
		} finally {
			setItem.mockRestore();
		}
	});

	it('writes the final size once when the release comes before the last move renders', async () => {
		const { region } = await mountRegion(BASE_CONFIG);
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		try {
			region().props._onResizeStart();
			region().props._onResizeMove(20);
			expect(region().size).toBe(280);

			// One batch: the last move has not rendered when the release lands.
			region().props._onResizeMove(40);
			region().props._onResizeEnd();
			expect(region().size).toBe(300);
			expect(setItem.mock.calls).toEqual([
				[KEY, JSON.stringify({ size: 300, isCollapsed: false })]
			]);
		} finally {
			setItem.mockRestore();
		}
	});

	it('keeps the size a region was dragged to when it unmounts mid-drag', async () => {
		const { screen, region } = await mountRegion(BASE_CONFIG);
		region().props._onResizeStart();
		region().props._onResizeMove(40);
		await screen.unmount();
		expect(readStored()).toEqual({ size: 300, isCollapsed: false });
	});

	it('does not touch storage without an autoSaveId', async () => {
		const { region } = await mountRegion({ defaultSize: 260, collapsible: true });
		region().collapse();
		expect(localStorage.length).toBe(0);
	});
});

describe('useResizable uncontrolled collapse', () => {
	it('starts collapsed from defaultIsCollapsed', async () => {
		const { region } = await mountRegion({
			defaultSize: 260,
			collapsible: true,
			defaultIsCollapsed: true
		});
		expect(region().isCollapsed).toBe(true);
		expect(region().size).toBe(0);

		region().expand();
		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(260);
	});

	it('ignores defaultIsCollapsed when not collapsible', async () => {
		const { region } = await mountRegion({ defaultSize: 260, defaultIsCollapsed: true });
		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(260);
	});

	it('lets a persisted collapse flag win over defaultIsCollapsed', async () => {
		localStorage.setItem(KEY, JSON.stringify({ size: 300, isCollapsed: false }));
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			defaultIsCollapsed: true
		});
		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(300);
	});

	it('keeps defaultIsCollapsed when a legacy width entry says nothing about collapse', async () => {
		localStorage.setItem(KEY, '300');
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			defaultIsCollapsed: true
		});
		expect(region().isCollapsed).toBe(true);
		// The width is still restored — it is only collapse that is unknown.
		region().expand();
		expect(region().size).toBe(300);
	});

	it('notifies onCollapseChange once per collapse and expand', async () => {
		const onCollapseChange = vi.fn();
		const { region } = await mountRegion({
			defaultSize: 260,
			collapsible: true,
			onCollapseChange
		});

		region().collapse();
		expect(onCollapseChange).toHaveBeenCalledExactlyOnceWith(true);

		onCollapseChange.mockClear();
		region().expand();
		expect(onCollapseChange).toHaveBeenCalledExactlyOnceWith(false);
	});

	it('collapses on a drag past the threshold', async () => {
		const onCollapseChange = vi.fn();
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			onCollapseChange
		});

		region().props._onResizeStart();
		region().props._onResizeMove(-240);
		expect(region().isCollapsed).toBe(false);
		region().props._onResizeEnd();

		expect(region().isCollapsed).toBe(true);
		expect(onCollapseChange).toHaveBeenCalledWith(true);
	});
});

describe('useResizable controlled collapse', () => {
	it('renders the controlled value rather than its own state', async () => {
		const config = {
			defaultSize: 260,
			collapsible: true,
			isCollapsed: true
		} satisfies UseResizableSingleConfig;
		const { screen, region } = await mountRegion(config);

		expect(region().isCollapsed).toBe(true);
		expect(region().size).toBe(0);

		await screen.rerender({ config: { ...config, isCollapsed: false }, version: 1 });
		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(260);
	});

	it('makes collapse() and expand() intents that change nothing locally', async () => {
		const onCollapseChange = vi.fn();
		const { region } = await mountRegion({
			defaultSize: 260,
			collapsible: true,
			isCollapsed: false,
			onCollapseChange
		});

		region().collapse();
		expect(onCollapseChange).toHaveBeenCalledExactlyOnceWith(true);
		// The owner said expanded and never changed its mind.
		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(260);
	});

	it('reports a drag past the threshold instead of collapsing itself', async () => {
		const onCollapseChange = vi.fn();
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			isCollapsed: false,
			onCollapseChange
		});

		region().props._onResizeStart();
		region().props._onResizeMove(-240);
		region().props._onResizeEnd();

		expect(onCollapseChange).toHaveBeenCalledWith(true);
		expect(region().isCollapsed).toBe(false);
	});

	it('persists the collapse state the owner holds', async () => {
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			isCollapsed: true
		});
		expect(region().isCollapsed).toBe(true);
		expect(readStored()).toEqual({ size: 260, isCollapsed: true });
	});
});

// The fix under test is @AKnassa's, from #5118.
describe('useResizable live collapse state', () => {
	it('reads the current controlled value before consumer layout effects', async () => {
		const onCollapseChange = vi.fn();
		const base = {
			defaultSize: 260,
			collapsible: true,
			isCollapsed: true,
			onCollapseChange
		} satisfies UseResizableSingleConfig;
		const { screen } = await mountRegion(base);

		await screen.rerender({
			config: { ...base, isCollapsed: false },
			version: 1,
			collapseOnUpdate: true
		});
		expect(onCollapseChange).toHaveBeenCalledExactlyOnceWith(true);
	});

	// ResizeHandle registers its pointermove listener once at pointer down, so
	// a whole gesture runs against the props object captured there. These tests
	// hold that snapshot instead of re-reading the region between moves.
	it('reports one collapse for a drag that stays below the threshold', async () => {
		const onCollapseChange = vi.fn();
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			onCollapseChange
		});

		region().props._onResizeStart();
		const gesture = region().props;
		for (const delta of [-240, -245, -250, -255, -260]) {
			gesture._onResizeMove(delta);
		}
		expect(onCollapseChange).not.toHaveBeenCalled();
		gesture._onResizeEnd();

		expect(onCollapseChange).toHaveBeenCalledExactlyOnceWith(true);
		expect(region().isCollapsed).toBe(true);
	});

	it('stays open when the drag crosses back above the threshold before the lift', async () => {
		const onCollapseChange = vi.fn();
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			onCollapseChange
		});

		region().props._onResizeStart();
		const gesture = region().props;
		gesture._onResizeMove(-240);
		gesture._onResizeMove(-20);
		gesture._onResizeEnd();

		expect(onCollapseChange).not.toHaveBeenCalled();
		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(240);
	});

	it('closes on a lift released fast enough to come to rest past the threshold', async () => {
		const onCollapseChange = vi.fn();
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			onCollapseChange
		});

		region().props._onResizeStart();
		region().props._onResizeMove(-100);
		// 1,500 px/s toward closing projects about 750 px further.
		endResizeAt(region().props, -1500);

		expect(onCollapseChange).toHaveBeenCalledExactlyOnceWith(true);
		expect(region().isCollapsed).toBe(true);
	});

	it('springs back to the minimum from a slow lift above the threshold', async () => {
		const { region } = await mountRegion({ ...BASE_CONFIG, collapsible: true });

		region().props._onResizeStart();
		region().props._onResizeMove(-130);
		endResizeAt(region().props, 0);

		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(BASE_CONFIG.minSize);
	});

	it('notifies when resize() lifts the panel out of collapse', async () => {
		const onCollapseChange = vi.fn();
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			onCollapseChange
		});

		region().collapse();
		onCollapseChange.mockClear();
		region().resize(300);

		expect(onCollapseChange).toHaveBeenCalledExactlyOnceWith(false);
		expect(region().isCollapsed).toBe(false);
		expect(region().size).toBe(300);
	});

	it('reports one collapse when collapse() runs twice in a tick', async () => {
		const onCollapseChange = vi.fn();
		const { region } = await mountRegion({
			...BASE_CONFIG,
			collapsible: true,
			onCollapseChange
		});

		region().collapse();
		region().collapse();

		expect(onCollapseChange).toHaveBeenCalledExactlyOnceWith(true);
	});
});

describe('useResizable identity', () => {
	it('keeps callbacks stable when optional snaps are omitted', async () => {
		const config = {
			defaultSize: 200,
			minSize: 100,
			maxSize: 400
		} satisfies UseResizableSingleConfig;
		const { screen, region } = await mountRegion(config);
		const first = {
			expand: region().expand,
			resize: region().resize,
			snaps: region().props._snaps
		};

		await screen.rerender({ version: 1 });

		expect(region().expand).toBe(first.expand);
		expect(region().resize).toBe(first.resize);
		expect(region().props._snaps).toBe(first.snaps);
	});

	// Upstream's `settles a pixel-only mount without a ref in one render pass`
	// and `settles 1/10/50 numeric-only mounts ...` count React render passes
	// and ResizeObserver constructions. Named in the header: Svelte has no
	// render pass, and the browser harness has one real shared observer.
});

describe('useResizable percentage configuration (AST-010)', () => {
	describe('FR1 — the basis a percentage is a share of', () => {
		it('keeps the released viewport basis when no container is given', async () => {
			// The compatibility path: this is what shipped, and it must not change.
			vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
			const { region } = await mountRegion({ defaultSize: '50%' });
			expect(region().size).toBe(500);
		});

		it('uses the container content box when one is given', async () => {
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion({ defaultSize: '50%', containerRef }, { containerRef });
			expect(region().size).toBe(200);
			expect(region().size).not.toBe(window.innerWidth / 2);
		});

		it('resolves the default once — a later basis change does not move it', async () => {
			// The line between "configures a size" and "is a responsive mode".
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion({ defaultSize: '50%', containerRef }, { containerRef });
			expect(region().size).toBe(200);
			setContainerWidth(container, 800);
			await vi.waitFor(() => expect(container.clientWidth).toBe(800));
			await tick();
			expect(region().size).toBe(200);
		});
	});

	describe('FR2 — direction selects the axis', () => {
		it('keeps the atomic percentage on the block axis', async () => {
			const container = makeContainer(400, 300);
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{ defaultSize: '50%', containerRef, direction: 'vertical' },
				{ containerRef }
			);
			expect(region().size).toBe(150);
		});

		it('measures a structured percentage on the block axis', async () => {
			const container = makeContainer(400, 300);
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{
					defaultSize: percent(50, { min: pixel(1) }),
					containerRef,
					direction: 'vertical'
				},
				{ containerRef }
			);
			// 50% of the 300px block size, not of the 400px inline size.
			expect(region().size).toBe(150);
		});
	});

	describe('FR4/FR6 — bounds re-resolve and clamp, they never scale', () => {
		it('clamps to a percentage maximum', async () => {
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{ defaultSize: 100, maxSize: '50%', containerRef },
				{ containerRef }
			);
			region().resize(9999);
			expect(region().size).toBe(200);
		});

		it('re-clamps the existing pixel size when the basis shrinks', async () => {
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{ defaultSize: 100, maxSize: '50%', containerRef },
				{ containerRef }
			);
			region().resize(9999);
			expect(region().size).toBe(200);
			setContainerWidth(container, 200);
			await vi.waitFor(() => expect(region().size).toBe(100));
		});

		it('does not scale a selection back up when the basis grows', async () => {
			// Clamping is not a ratio. A size that fits its new maximum stays put.
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{ defaultSize: 100, maxSize: '50%', containerRef },
				{ containerRef }
			);
			region().resize(150);
			setContainerWidth(container, 1000);
			await vi.waitFor(() => expect(container.clientWidth).toBe(1000));
			await tick();
			expect(region().size).toBe(150);
		});

		it('a clamp is permanent — growing the basis does not revive the old size', async () => {
			// Deriving the clamp for paint alone left the stored choice intact, so a
			// container that shrank and grew again brought the pre-clamp size back.
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{ defaultSize: 100, maxSize: '50%', containerRef },
				{ containerRef }
			);
			region().resize(9999);
			expect(region().size).toBe(200);
			setContainerWidth(container, 200);
			await vi.waitFor(() => expect(region().size).toBe(100));
			setContainerWidth(container, 4000);
			await vi.waitFor(() => expect(container.clientWidth).toBe(4000));
			await tick();
			expect(region().size).toBe(100);
		});

		it('does not revive a default clamped at initialization', async () => {
			// A default is a pixel selection once its first basis resolves.
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{ defaultSize: 321, maxSize: '50%', containerRef },
				{ containerRef }
			);
			expect(region().size).toBe(200);
			setContainerWidth(container, 800);
			await vi.waitFor(() => expect(container.clientWidth).toBe(800));
			await tick();
			expect(region().size).toBe(200);
		});

		it('mixes units across the default and the bounds', async () => {
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{
					defaultSize: '50%',
					minSize: 120,
					maxSize: '80px',
					containerRef
				},
				{ containerRef }
			);
			// Inverted on purpose: the maximum wins, as the released clamp order has
			// always done.
			expect(region().size).toBe(80);
		});

		it('warns as useResizable, in the words it always used', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const inverted = await mountRegion({
				defaultSize: 200,
				minSize: 300,
				maxSize: 100
			});
			expect(warn).toHaveBeenCalledWith(
				'useResizable: the resolved minimum (300px) is above the resolved ' +
					'maximum (100px). The maximum wins, as it always has.'
			);
			inverted.region().resize(Number.NaN);
			expect(warn).toHaveBeenCalledWith(
				'useResizable: resize(NaN) is not a pixel size. Keeping the current ' +
					'size. Percentages configure the hook; they are not a programmatic ' +
					'input.'
			);
			await inverted.screen.unmount();
			warn.mockClear();
			await mountRegion({ defaultSize: pixel(-1) });
			expect(warn.mock.calls.length).toBeGreaterThan(0);
			for (const [message] of warn.mock.calls) {
				expect(String(message)).toMatch(/^useResizable: /);
			}
			warn.mockRestore();
		});

		it('permanently re-clamps a caller-recomputed numeric maxSize', async () => {
			const config = {
				defaultSize: 400,
				minSize: 300,
				maxSize: 1500
			} satisfies UseResizableSingleConfig;
			const { screen, region } = await mountRegion(config);

			// The user drags the separator out to 1066px, well inside the
			// 1500px ceiling the wide surface currently allows.
			region().resize(1066);
			expect(region().size).toBe(1066);

			// The surface then narrows (no drag involved), so the derived ceiling
			// drops under the size the user chose.
			await screen.rerender({ config: { ...config, maxSize: 834 }, version: 1 });

			expect(region().size).toBe(834);
			expect(region().props._size).toBe(834);
			expect(region().props._maxSizePx).toBe(834);

			// Growing the surface again must not revive the pre-clamp selection.
			await screen.rerender({ config: { ...config, maxSize: 1500 }, version: 2 });

			expect(region().size).toBe(834);
			expect(region().props._size).toBe(834);
			expect(region().props._maxSizePx).toBe(1500);
		});

		it('leaves an in-range user choice alone when maxSize shrinks', async () => {
			// The other half of #5934's fix: clamping must not become a second
			// proportional-resize mode.
			const config = {
				defaultSize: 400,
				minSize: 300,
				maxSize: 1500
			} satisfies UseResizableSingleConfig;
			const { screen, region } = await mountRegion(config);

			region().resize(700);
			await screen.rerender({ config: { ...config, maxSize: 834 }, version: 1 });

			expect(region().size).toBe(700);
		});
	});

	describe('structured percent sizes', () => {
		it('accepts Table pixel as a structured static value', async () => {
			const { region } = await mountRegion({
				defaultSize: pixel(333),
				minSize: pixel(100),
				maxSize: pixel(500)
			});
			expect(region().size).toBe(333);
			expect(region().props._minSizePx).toBe(100);
			expect(region().props._maxSizePx).toBe(500);
		});

		it('applies the canonical percentage floor', async () => {
			const container = makeContainer(500);
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{
					defaultSize: 0,
					minSize: percent(40, { min: pixel(333) }),
					containerRef
				},
				{ containerRef }
			);

			expect(region().props._minSizePx).toBe(333);
			expect(region().size).toBe(333);
			setContainerWidth(container, 1000);
			await vi.waitFor(() => expect(region().props._minSizePx).toBe(400));
			expect(region().size).toBe(400);
		});

		it('applies the canonical percentage ceiling', async () => {
			const container = makeContainer(1000);
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{
					defaultSize: 500,
					maxSize: percent(10, { max: pixel(400) }),
					containerRef
				},
				{ containerRef }
			);

			expect(region().props._maxSizePx).toBe(100);
			expect(region().size).toBe(100);
			setContainerWidth(container, 500);
			await vi.waitFor(() => expect(region().props._maxSizePx).toBe(50));
			expect(region().size).toBe(50);
		});

		it('resolves a structured default once, then keeps the selected pixels', async () => {
			const container = makeContainer(1000);
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{
					defaultSize: percent(40, { min: pixel(333) }),
					containerRef
				},
				{ containerRef }
			);

			expect(region().size).toBe(400);
			expect(isResizeObserved(container)).toBe(false);
			setContainerWidth(container, 500);
			await vi.waitFor(() => expect(container.clientWidth).toBe(500));
			await tick();
			expect(region().size).toBe(400);
		});

		it('uses the initial viewport for a structured default without subscribing', async () => {
			vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1000);
			const addEventListener = vi.spyOn(window, 'addEventListener');
			const { region } = await mountRegion({
				defaultSize: percent(40, { min: pixel(333) })
			});

			expect(region().size).toBe(400);
			expect(addEventListener.mock.calls.some(([type]) => type === 'resize')).toBe(false);
			vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(500);
			window.dispatchEvent(new Event('resize'));
			await tick();
			expect(region().size).toBe(400);
		});

		// `uses the deterministic 1200px server basis` and `hydrates a container
		// default without persisting the temporary basis` are in the companion
		// `use-resizable-hydration.svelte.test.ts`.

		it('waits for a positive basis and then removes a default-only observer', async () => {
			const container = makeContainer(0);
			const containerRef = { current: container };
			const onSizeChange = vi.fn();
			const { region } = await mountRegion(
				{
					defaultSize: percent(40, { min: pixel(333) }),
					containerRef,
					autoSaveId: 'structured-zero',
					onSizeChange
				},
				{ containerRef }
			);

			expect(region().size).toBe(480);
			expect(localStorage.getItem('astryx-resizable:structured-zero')).toBeNull();
			expect(isResizeObserved(container)).toBe(true);
			setContainerWidth(container, 500);
			await vi.waitFor(() => expect(region().size).toBe(333));
			expect(localStorage.getItem('astryx-resizable:structured-zero')).toBe(
				JSON.stringify({ size: 333, isCollapsed: false })
			);
			expect(onSizeChange).not.toHaveBeenCalled();
			expect(isResizeObserved(container)).toBe(false);
		});

		it('removes the default observer when resize selects pixels before layout', async () => {
			const container = makeContainer(0);
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{
					defaultSize: percent(40, { min: pixel(333) }),
					containerRef
				},
				{ containerRef }
			);

			expect(isResizeObserved(container)).toBe(true);
			region().resize(275);
			setContainerWidth(container, 500);
			await vi.waitFor(() => expect(container.clientWidth).toBe(500));
			await tick();
			expect(region().size).toBe(275);
			expect(isResizeObserved(container)).toBe(false);
		});

		it('lets a persisted pixel choice win without measuring the unused default', async () => {
			localStorage.setItem(
				'astryx-resizable:structured-persisted',
				JSON.stringify({ size: 321, isCollapsed: false })
			);
			const container = makeContainer(1000);
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{
					defaultSize: percent(40, { min: pixel(333) }),
					containerRef,
					autoSaveId: 'structured-persisted'
				},
				{ containerRef }
			);

			expect(region().size).toBe(321);
			expect(isResizeObserved(container)).toBe(false);
		});

		it('measures the current basis before a newly added bound can clamp', async () => {
			const container = makeContainer(500);
			const containerRef = { current: container };
			const config = {
				defaultSize: percent(40, { min: pixel(333) }),
				containerRef
			} satisfies UseResizableSingleConfig;
			const { screen, region } = await mountRegion(config, { containerRef });

			expect(region().size).toBe(333);
			region().resize(450);
			setContainerWidth(container, 1000);
			await screen.rerender({
				config: {
					...config,
					maxSize: percent(50, { max: pixel(800) })
				},
				version: 1
			});

			expect(region().props._maxSizePx).toBe(500);
			expect(region().size).toBe(450);
			expect(isResizeObserved(container)).toBe(true);
		});

		// `matches an atomic percentage default render count and drops both
		// observers` counts React renders; named in the header.

		it('treats an explicitly undefined opposite bound as absent', async () => {
			const container = makeContainer(500);
			const containerRef = { current: container };
			const floor = percent(40, { min: pixel(333), max: undefined });
			const ceiling = percent(80, { min: undefined, max: pixel(350) });

			const minimum = await mountRegion({ defaultSize: floor, containerRef }, { containerRef });
			expect(minimum.region().size).toBe(333);
			await minimum.screen.unmount();

			const maximum = await mountRegion({ defaultSize: ceiling, containerRef }, { containerRef });
			expect(maximum.region().size).toBe(350);
			await maximum.screen.unmount();
		});

		it.each([
			['negative', pixel(-1)],
			['NaN', pixel(Number.NaN)],
			['Infinity', pixel(Infinity)]
		])('rejects an invalid direct PixelWidth: %s', async (_label, invalid) => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { region } = await mountRegion({ defaultSize: invalid });
			expect(region().size).toBe(250);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('Falling back to 250'));
			if (_label === 'Infinity') {
				expect(warn).toHaveBeenCalledWith(
					expect.stringContaining('{"type":"pixel","value":Infinity}')
				);
			}
			warn.mockRestore();
		});

		it('rejects the removed CSS-like grammar', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { region } = await mountRegion({
				defaultSize: 10,
				minSize: 'max(40%, 333px)' as never,
				maxSize: 'min(400px, 10%)' as never
			} as never);

			expect(region().size).toBe(50);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('minSize: "max(40%, 333px)"'));
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('maxSize: "min(400px, 10%)"'));
			warn.mockRestore();
		});

		it('applies role-specific fallbacks to invalid structured bounds', async () => {
			const invalid = {
				type: 'percent',
				value: 40,
				min: pixel(100),
				max: pixel(500)
			};
			const minimum = await mountRegion({
				defaultSize: 10,
				minSize: invalid as never
			});
			expect(minimum.region().size).toBe(50);
			await minimum.screen.unmount();

			const maximum = await mountRegion({
				defaultSize: 10_000,
				maxSize: invalid as never
			});
			expect(maximum.region().size).toBe(10_000);
			await maximum.screen.unmount();
		});

		it.each([
			['wrong discriminator', { type: 'proportional', value: 40, min: pixel(100) }],
			['missing bound', { type: 'percent', value: 40 }],
			['both bounds', { type: 'percent', value: 40, min: pixel(100), max: pixel(500) }],
			['negative percentage', { type: 'percent', value: -1, min: pixel(100) }],
			['high percentage', { type: 'percent', value: 101, min: pixel(100) }],
			['non-finite percentage', { type: 'percent', value: Infinity, min: pixel(100) }],
			['negative pixel helper', { type: 'percent', value: 40, min: { type: 'pixel', value: -1 } }],
			[
				'non-finite pixel helper',
				{ type: 'percent', value: 40, max: { type: 'pixel', value: Infinity } }
			],
			['raw numeric bound', { type: 'percent', value: 40, min: 100 }]
		])('rejects an invalid structured value: %s', async (_label, invalid) => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { region } = await mountRegion({ defaultSize: invalid as never });
			expect(region().size).toBe(250);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('Falling back to 250'));
			if (_label === 'non-finite pixel helper') {
				expect(warn).toHaveBeenCalledWith(
					expect.stringContaining('"max":{"type":"pixel","value":Infinity}')
				);
			}
			warn.mockRestore();
		});
	});
});

describe('useResizable percentage configuration (AST-010) — state and parsing', () => {
	describe('FR5 — state, ARIA and paint describe one geometry', () => {
		it('publishes the clamped size and the resolved bounds', async () => {
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{ defaultSize: 100, maxSize: '50%', containerRef },
				{ containerRef }
			);
			region().resize(9999);
			expect(region().props._size).toBe(200);
			expect(region().props._maxSizePx).toBe(200);
			expect(region().props._size).toBeLessThanOrEqual(region().props._maxSizePx);
		});
	});

	describe('FR10 — a basis change is not a user interaction', () => {
		it('does not fire onSizeChange when a bound re-clamps the size', async () => {
			const container = makeContainer();
			const containerRef = { current: container };
			const onSizeChange = vi.fn();
			const { region } = await mountRegion(
				{
					defaultSize: 100,
					maxSize: '50%',
					containerRef,
					onSizeChange
				},
				{ containerRef }
			);
			region().resize(9999);
			onSizeChange.mockClear();
			setContainerWidth(container, 200);
			await vi.waitFor(() => expect(region().size).toBe(100));
			expect(onSizeChange).not.toHaveBeenCalled();
		});
	});

	describe('FR12/API3 — exact parsing, role-specific fallbacks', () => {
		it.each([
			['50 px', 'a space'],
			['50rem', 'another unit'],
			['120%', 'above 100%'],
			['-10px', 'negative'],
			['abc', 'not a size'],
			[-1, 'a negative number'],
			[Number.NaN, 'NaN']
		])('falls back to 250px for defaultSize %s (%s)', async (invalid, _why) => {
			const { region } = await mountRegion({
				defaultSize: invalid as never
			});
			expect(region().size).toBe(250);
		});

		it('falls back to 50px for an invalid minimum', async () => {
			const { region } = await mountRegion({
				defaultSize: 10,
				minSize: 'nope' as never
			});
			expect(region().size).toBe(50);
		});

		it('falls back to unbounded for an invalid maximum', async () => {
			const { region } = await mountRegion({
				defaultSize: 10_000,
				maxSize: 'nope' as never
			});
			expect(region().size).toBe(10_000);
		});

		it('accepts an exact px string', async () => {
			const { region } = await mountRegion({ defaultSize: '180px' });
			expect(region().size).toBe(180);
		});

		it('keeps explicit maxSize: Infinity valid without warning', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { region } = await mountRegion({ defaultSize: 900, maxSize: Infinity });
			expect(region().size).toBe(900);
			expect(warn).not.toHaveBeenCalled();
			warn.mockRestore();
		});

		it('names a non-finite invalid input in its warning', async () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { region } = await mountRegion({ defaultSize: Number.NaN });
			expect(region().size).toBe(250);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('defaultSize: NaN is not a size'));
			warn.mockRestore();
		});
	});

	describe('API6 — resize stays pixels and keeps the last legal size', () => {
		it.each([Number.NaN, Infinity, -5])('ignores resize(%s)', async (bad) => {
			const { region } = await mountRegion({ defaultSize: 200 });
			region().resize(bad);
			expect(region().size).toBe(200);
			expect(Number.isFinite(region().size)).toBe(true);
		});
	});
});

describe('useResizable multi-region and persistence', () => {
	describe('FR11 — multi-region shares one container and axis', () => {
		it('keeps atomic percentage regions independent', async () => {
			const container = makeContainer();
			const containerRef = { current: container };
			let regions!: Record<string, ResizableRegion>;
			const screen = await render(MultiProbe, {
				props: {
					config: {
						containerRef,
						regions: {
							left: { defaultSize: '25%' },
							right: { defaultSize: '50%' }
						}
					},
					containerRef,
					onRegions: (next) => (regions = next)
				}
			});
			expect(regions.left.size).toBe(100);
			expect(regions.right.size).toBe(200);
			regions.left.resize(160);
			expect(regions.left.size).toBe(160);
			expect(regions.right.size).toBe(200);
			await screen.unmount();
		});

		it('gives every structured region the same basis without coupling sizes', async () => {
			const container = makeContainer();
			const containerRef = { current: container };
			let regions!: Record<string, ResizableRegion>;
			const screen = await render(MultiProbe, {
				props: {
					config: {
						containerRef,
						regions: {
							left: { defaultSize: percent(25, { min: pixel(80) }) },
							right: { defaultSize: percent(50, { max: pixel(300) }) }
						}
					},
					containerRef,
					onRegions: (next) => (regions = next)
				}
			});
			expect(regions.left.size).toBe(100);
			expect(regions.right.size).toBe(200);
			regions.left.resize(160);
			// Independent: moving one leaves the other alone.
			expect(regions.left.size).toBe(160);
			expect(regions.right.size).toBe(200);
			await screen.unmount();
		});
	});

	describe('FR9 — persistence stays pixel-only', () => {
		it('restores a persisted pixel size over a percentage default', async () => {
			localStorage.setItem(
				'astryx-resizable:pct-persist',
				JSON.stringify({ size: 321, isCollapsed: false })
			);
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{
					defaultSize: '50%',
					containerRef,
					autoSaveId: 'pct-persist'
				},
				{ containerRef }
			);
			expect(region().size).toBe(321);
			localStorage.clear();
		});

		it('never writes a percentage to storage', async () => {
			const container = makeContainer();
			const containerRef = { current: container };
			const { region } = await mountRegion(
				{
					defaultSize: '50%',
					containerRef,
					autoSaveId: 'pct-write'
				},
				{ containerRef }
			);
			region().resize(175);
			const raw = localStorage.getItem('astryx-resizable:pct-write');
			expect(raw).toBe(JSON.stringify({ size: 175, isCollapsed: false }));
			localStorage.clear();
		});
	});
});

describe('useResizable API1 — the basis follows the element the ref points at', () => {
	/** A container of a fixed content width, independent of any other basis. */
	const makeSized = (width: number) => makeContainer(width, 300);

	it('reconciles a live ref replacement before flushSync returns', async () => {
		// Svelte's counterpart of `flushSync` is the rerender itself: its update
		// has committed by the time `rerender` resolves.
		const first = makeSized(400);
		const second = makeSized(800);
		const containerRef: { current: HTMLElement | null } = { current: first };
		const config = {
			containerRef,
			defaultSize: 100,
			minSize: '50%'
		} satisfies UseResizableSingleConfig;
		const { screen, region } = await mountRegion(config, { containerRef });

		expect(region().size).toBe(200);

		containerRef.current = second;
		await screen.rerender({ version: 1 });
		expect(region().size).toBe(400);
	});

	it('starts following the current ref when a pixel-only config gains a percentage bound', async () => {
		const first = makeSized(400);
		const replacement = makeSized(800);
		const containerRef: { current: HTMLElement | null } = { current: first };
		const config = { containerRef, defaultSize: 350 } satisfies UseResizableSingleConfig;
		const { screen, region } = await mountRegion(config, { containerRef });

		expect(region().size).toBe(350);
		expect(isResizeObserved(first)).toBe(false);

		containerRef.current = replacement;
		await screen.rerender({
			config: {
				...config,
				maxSize: percent(50, { max: pixel(600) })
			},
			version: 1
		});

		expect(region().props._maxSizePx).toBe(400);
		expect(region().size).toBe(350);
		expect(isResizeObserved(first)).toBe(false);
		expect(isResizeObserved(replacement)).toBe(true);
	});

	it('does not clamp against an old element when a percentage bound returns', async () => {
		const first = makeSized(400);
		const replacement = makeSized(800);
		const containerRef: { current: HTMLElement | null } = { current: first };
		const config = {
			containerRef,
			defaultSize: 100,
			maxSize: '50%'
		} satisfies UseResizableSingleConfig;
		const { screen, region } = await mountRegion(config, { containerRef });

		expect(region().props._maxSizePx).toBe(200);
		await screen.rerender({ config: { ...config, maxSize: undefined }, version: 1 });
		region().resize(350);
		expect(region().size).toBe(350);
		expect(isResizeObserved(first)).toBe(false);

		containerRef.current = replacement;
		await screen.rerender({
			config: {
				...config,
				maxSize: percent(50, { max: pixel(600) })
			},
			version: 2
		});

		expect(region().props._maxSizePx).toBe(400);
		expect(region().size).toBe(350);
		expect(isResizeObserved(first)).toBe(false);
		expect(isResizeObserved(replacement)).toBe(true);
	});

	it('re-resolves against the replacement when the ref changes element', async () => {
		// A ref object is stable across an element swap, so nothing about the
		// hook's inputs changes: the subscription has to follow the ref itself.
		const first = makeSized(398);
		const second = makeSized(798);
		const containerRef: { current: HTMLElement | null } = { current: first };
		const config = {
			containerRef,
			defaultSize: 150,
			maxSize: '50%'
		} satisfies UseResizableSingleConfig;
		const { screen, region } = await mountRegion(config, { containerRef });
		expect(region().props._maxSizePx).toBe(199);

		containerRef.current = second;
		await screen.rerender({ version: 1 });
		expect(region().props._maxSizePx).toBe(399);
	});

	it('follows a container swapped behind the ref with a configuration object kept across renders', async () => {
		// A module constant or a memoized object: no new options reach the
		// region when the element behind its ref changes.
		const first = makeSized(398);
		const second = makeSized(798);
		const containerRef: { current: HTMLElement | null } = { current: first };
		const config = { containerRef, defaultSize: 150, maxSize: '50%' } as const;
		const { screen, region } = await mountRegion(config, { containerRef });
		expect(region().props._maxSizePx).toBe(199);

		containerRef.current = second;
		await screen.rerender({ version: 1 });
		expect(region().props._maxSizePx).toBe(399);
	});

	it('stops observing the element it left behind', async () => {
		const first = makeSized(398);
		const second = makeSized(798);
		const containerRef: { current: HTMLElement | null } = { current: first };
		const config = {
			containerRef,
			defaultSize: 150,
			maxSize: '50%'
		} satisfies UseResizableSingleConfig;
		const { screen } = await mountRegion(config, { containerRef });
		expect(isResizeObserved(first)).toBe(true);

		containerRef.current = second;
		await screen.rerender({ version: 1 });
		// The old node is detached by now; leaving it observed is what reported
		// a content box of 0 and zeroed the bounds.
		expect(isResizeObserved(first)).toBe(false);
		expect(isResizeObserved(second)).toBe(true);
	});

	it('treats an unlaid-out container as unmeasured, not as zero', async () => {
		// display:none, detached, or not yet laid out: all report 0. Resolving a
		// percentage against 0 makes every bound 0.
		const hidden = makeSized(0);
		const containerRef = { current: hidden };
		const { region } = await mountRegion(
			{
				containerRef,
				defaultSize: 200,
				maxSize: '50%'
			},
			{ containerRef }
		);
		// The documented temporary 1200px basis, not 0.
		expect(region().props._maxSizePx).toBe(600);
		expect(region().size).toBe(200);
	});

	it('does not overwrite a saved size from an unmeasured basis', async () => {
		localStorage.setItem(
			'astryx-resizable:hidden-mount',
			JSON.stringify({ size: 321, isCollapsed: false })
		);
		const hidden = makeSized(0);
		const containerRef = { current: hidden };
		await mountRegion(
			{
				containerRef,
				defaultSize: 200,
				maxSize: '50%',
				autoSaveId: 'hidden-mount'
			},
			{ containerRef }
		);
		expect(localStorage.getItem('astryx-resizable:hidden-mount')).toBe(
			JSON.stringify({ size: 321, isCollapsed: false })
		);
		localStorage.clear();
	});

	// `resolves a percentage default against its container once measured,
	// after an <Activity> hid and showed the region before then` needs React's
	// `<Activity>`; named in the header.

	it('still persists for a pixel-only region that supplies a container', async () => {
		// The "is the basis measured yet" guard must not disable persistence for
		// a region that never asks for a percentage in the first place.
		const container = makeSized(400);
		const containerRef = { current: container };
		const { region } = await mountRegion(
			{ containerRef, defaultSize: 200, autoSaveId: 'px-only' },
			{ containerRef }
		);
		region().resize(240);
		expect(localStorage.getItem('astryx-resizable:px-only')).toBe(
			JSON.stringify({ size: 240, isCollapsed: false })
		);
		localStorage.clear();
	});
});

describe('useResizable FR7 — every terminal gesture releases the frozen basis', () => {
	it.each([
		['_onResizeEnd', (p: ResizableProps) => p._onResizeEnd()],
		['_onResizeCancel', (p: ResizableProps) => p._onResizeCancel?.()]
	])('%s lets the bounds re-resolve', async (_name, finish) => {
		const container = makeContainer();
		const containerRef = { current: container };
		const { region } = await mountRegion(
			{ containerRef, defaultSize: 200, maxSize: '50%' },
			{ containerRef }
		);
		expect(region().props._maxSizePx).toBe(200);

		region().props._onResizeStart();
		// The container shrinks mid-gesture: the bound must hold until the
		// gesture is over, so the handle does not move away from the pointer.
		setContainerWidth(container, 200);
		await vi.waitFor(() => expect(container.clientWidth).toBe(200));
		await settleResizeObserver();
		expect(region().props._maxSizePx).toBe(200);

		finish(region().props);
		expect(region().props._maxSizePx).toBe(100);
		expect(region().size).toBe(100);
	});

	it('writes only the re-clamped size when the container shrank mid-drag', async () => {
		const key = 'astryx-resizable:pct-release';
		const container = makeContainer(600);
		const containerRef = { current: container };
		const { region } = await mountRegion(
			{
				containerRef,
				defaultSize: 200,
				maxSize: '50%',
				autoSaveId: 'pct-release'
			},
			{ containerRef }
		);
		expect(region().props._maxSizePx).toBe(300);
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		const writes = () => setItem.mock.calls.filter(([k]) => k === key);
		try {
			region().props._onResizeStart();
			region().props._onResizeMove(80);
			expect(region().size).toBe(280);
			// The bound holds at 300 until the release, which re-clamps to 200.
			setContainerWidth(container, 400);
			await vi.waitFor(() => expect(container.clientWidth).toBe(400));
			await settleResizeObserver();
			expect(region().size).toBe(280);
			expect(writes()).toHaveLength(0);

			region().props._onResizeEnd();
			expect(region().size).toBe(200);
			expect(writes()).toEqual([[key, JSON.stringify({ size: 200, isCollapsed: false })]]);
		} finally {
			setItem.mockRestore();
			localStorage.removeItem(key);
		}
	});
});

describe('Resizable size source compatibility (AST-010 API3/API4)', () => {
	it('keeps the released broad default type and adds structured values', () => {
		const computed: string = 'runtime-validated-string';
		const configs = [
			{ defaultSize: computed },
			{ defaultSize: 333 },
			{ defaultSize: '333px' },
			{ defaultSize: '40%' },
			{ defaultSize: pixel(333) },
			{ defaultSize: percent(40, { min: pixel(333) }) },
			{ defaultSize: 0, minSize: percent(40, { min: pixel(333) }) },
			{ defaultSize: 500, maxSize: percent(10, { max: pixel(400) }) },
			{ defaultSize: 260, minSize: 180, maxSize: 480 }
		] satisfies UseResizableSingleConfig[];
		expect(configs).toHaveLength(9);
	});

	// `rejects unsupported bound strings and removed pixel aliases` cannot be
	// ported whole: this port keeps `minSizePx` / `maxSizePx` as documented
	// aliases, so the three `@ts-expect-error` claims do not hold. Named in the
	// header.
});

describe('ResizableProps source compatibility (AST-010 API5)', () => {
	it('accepts an object literal written before _direction existed', () => {
		// The type is exported. Every field added to it since has to be optional,
		// or a hand-built object that satisfied the released type stops compiling.
		const prePr: ResizableProps = {
			_size: 200,
			_isCollapsed: false,
			_onResizeStart: () => {},
			_onResizeMove: () => {},
			_onResizeEnd: () => {},
			_minSizePx: 100,
			_maxSizePx: 400,
			_snaps: [],
			_collapsedSize: 40,
			_collapsible: false,
			_isResizableProps: true
		};
		expect(prePr._direction).toBeUndefined();
		expect(prePr._onResizeCancel).toBeUndefined();
	});
});

// `useResizable window reads after a commit` is React's
// `useSyncExternalStore` post-commit read; named in the header.
