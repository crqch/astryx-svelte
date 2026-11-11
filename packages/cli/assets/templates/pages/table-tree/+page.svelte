<!--
	Ported from upstream's `assets/templates/pages/table-tree/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Lucide throughout, as upstream's are: `@lucide/svelte` is
	`lucide-react`'s Svelte build and keeps the names, so the import below is
	upstream's with the package name changed. A repository page needs branch and
	fork glyphs and Heroicons has no git iconography at all.

	Upstream's two StyleX rules are inline styles here: `headerContainer` and
	`readmeTabs` are each `padding-inline: 4px`, and the selected-row wash
	(`inset 0 0 0 100vmax` in `--color-background-blue`) is written into the
	keyboard plugin's `transformBodyRow` because that is the only
	`transformBodyRow` in the bag.

	The React hooks map one-for-one: `useState` is `$state`, `useMemo` is
	`$derived`/`$derived.by`, `useCallback` is a plain function, and
	`useMeasuredWidth` is an attachment plus a `ResizeObserver` in an `$effect`.
	`useTableTreeState`, `useTableTreeData`, `useTableSortableState`,
	`useTableSortable` and `useTableColumnResize` all take getters and return
	live objects, so nothing here destructures a hook result. `searchRef` becomes
	an id, since `TextInput` publishes no `ref`; the focus and blur effects
	resolve the element by id.

	`useTreeKeyboardNav` is upstream's local plugin, unchanged in behaviour:
	`onkeydown` rather than `onKeyDown`, `tabindex`/`onclick` on the row, and the
	roving cursor plus the selection wash.
-->
<script lang="ts">
	import {
		Avatar,
		Badge,
		Breadcrumbs,
		BreadcrumbItem,
		Button,
		Card,
		Divider,
		DropdownMenu,
		EmptyState,
		HStack,
		Heading,
		Icon,
		IconButton,
		Layout,
		LayoutContent,
		LayoutPanel,
		Link,
		Markdown,
		Section,
		SizeProvider,
		StackItem,
		Tab,
		TabList,
		Table,
		Text,
		TextInput,
		Token,
		Toolbar,
		VStack,
		VisuallyHidden,
		pixel,
		proportional,
		useMediaQuery,
		useTableColumnResize,
		useTableSortable,
		useTableSortableState,
		useTableTreeData,
		useTableTreeState,
		type TableColumn,
		type TablePlugin
	} from '@astryx-svelte/core';
	/*
	 * Lucide throughout, not Heroicons. A repository page needs a branch and a
	 * fork glyph and Heroicons has no git iconography at all, so mixing sets was
	 * the only alternative — two libraries drawn on different grids, at different
	 * stroke weights, sitting side by side in the same toolbar.
	 */
	import {
		BookOpen,
		ChartColumn,
		Code,
		Eye,
		File,
		Folder,
		GitBranch,
		GitFork,
		Scale,
		Search,
		ShieldCheck,
		Star,
		Tag
	} from '@lucide/svelte';

	// ============= DATA =============

	type EntryKind = 'folder' | 'typescript' | 'json' | 'yaml' | 'markdown' | 'text';

	interface RepoEntry extends Record<string, unknown> {
		/** Full path. Doubles as the ArrowLeft parent link and the row key. */
		id: string;
		name: string;
		kind: EntryKind;
		/** Empty on folders — `withRollups` copies the newest commit beneath them. */
		commitMessage: string;
		/** Epoch ms. Zero on folders — `withRollups` takes the newest descendant. */
		committedAt: number;
		children?: RepoEntry[];
	}

	/** The repository whose tree fills the table. */
	const ROOT_NAME = 'canvas-editor';

	/*
	 * Every file gets the same glyph. Only one distinction earns its keep in this
	 * column — folder or not, because that is what predicts whether a row expands.
	 * Splitting files further by extension paints four near-identical shapes that
	 * repeat the name sitting next to them.
	 */
	const KIND_ICON = {
		folder: Folder,
		typescript: File,
		json: File,
		yaml: File,
		markdown: File,
		text: File
	};

	/**
	 * A fixed clock. Every age is authored as an offset from it, so "2 hours ago"
	 * stays "2 hours ago" in each environment and in the docsite's snapshots —
	 * which a real `Date.now()` could not promise.
	 */
	const NOW = Date.UTC(2026, 8, 9, 16, 0);

	const minutesAgo = (count: number): number => NOW - count * 60_000;
	const hoursAgo = (count: number): number => NOW - count * 3_600_000;
	const daysAgo = (count: number): number => NOW - count * 86_400_000;

	function file(
		path: string,
		kind: EntryKind,
		commitMessage: string,
		committedAt: number
	): RepoEntry {
		return {
			id: path,
			name: path.slice(path.lastIndexOf('/') + 1),
			kind,
			commitMessage,
			committedAt
		};
	}

	function folder(path: string, children: RepoEntry[]): RepoEntry {
		return {
			id: path,
			name: path.slice(path.lastIndexOf('/') + 1),
			kind: 'folder',
			commitMessage: '',
			committedAt: 0,
			children
		};
	}

	const REPO_TREE: RepoEntry[] = [
		folder('.github', [
			folder('.github/workflows', [
				file(
					'.github/workflows/ci.yml',
					'yaml',
					'ci: cache the pnpm store between runs (#412)',
					hoursAgo(3)
				),
				file(
					'.github/workflows/release.yml',
					'yaml',
					'ci: publish npm provenance on tagged releases (#398)',
					daysAgo(12)
				)
			]),
			file(
				'.github/PULL_REQUEST_TEMPLATE.md',
				'markdown',
				'docs: ask for a repro link in bug reports (#377)',
				daysAgo(61)
			)
		]),
		folder('docs', [
			folder('docs/architecture', [
				file(
					'docs/architecture/rendering.md',
					'markdown',
					'docs: explain the dirty-rect redraw path (#405)',
					daysAgo(5)
				),
				file(
					'docs/architecture/state.md',
					'markdown',
					'docs: describe undo stack ownership (#390)',
					daysAgo(21)
				)
			]),
			// The one nested README. GitHub renders whichever README sits in the
			// folder you are looking at, so this folder gets a preview and the others
			// get none — which is the behaviour worth showing.
			file(
				'docs/README.md',
				'markdown',
				'docs: add an index for the docs folder (#411)',
				daysAgo(3)
			),
			file(
				'docs/contributing.md',
				'markdown',
				'docs: document the release checklist (#402)',
				daysAgo(8)
			),
			file(
				'docs/getting-started.md',
				'markdown',
				'docs: add a first-plugin walkthrough (#369)',
				daysAgo(64)
			)
		]),
		folder('src', [
			folder('src/components', [
				// Three levels deep, so the header trail can outgrow the bar and the
				// collapse menu has something to collapse.
				folder('src/components/canvas', [
					file(
						'src/components/canvas/Canvas.tsx',
						'typescript',
						'fix: keep pointer capture through a drag (#417)',
						hoursAgo(2)
					),
					file(
						'src/components/canvas/layers.ts',
						'typescript',
						'feat: let a group be locked without hiding it (#413)',
						hoursAgo(9)
					),
					file(
						'src/components/canvas/pointer.ts',
						'typescript',
						'fix: release capture when the window blurs (#417)',
						hoursAgo(2)
					)
				]),
				file(
					'src/components/Inspector.tsx',
					'typescript',
					'feat: group the transform fields into one panel (#409)',
					daysAgo(4)
				),
				file(
					'src/components/Toolbar.tsx',
					'typescript',
					'refactor: derive tool state from the store (#396)',
					daysAgo(14)
				)
			]),
			folder('src/lib', [
				file(
					'src/lib/geometry.ts',
					'typescript',
					'perf: stop reallocating the bounds buffer (#414)',
					hoursAgo(20)
				),
				file(
					'src/lib/serialize.ts',
					'typescript',
					'fix: round-trip empty groups without loss (#401)',
					daysAgo(9)
				),
				file(
					'src/lib/shapes.ts',
					'typescript',
					'feat: add polygon and star primitives (#411)',
					daysAgo(3)
				)
			]),
			file(
				'src/main.ts',
				'typescript',
				'chore: move bootstrap behind a feature flag (#415)',
				daysAgo(1)
			),
			file(
				'src/ui.tsx',
				'typescript',
				'fix: restore focus after the modal closes (#407)',
				daysAgo(6)
			)
		]),
		folder('tests', [
			file(
				'tests/geometry.test.ts',
				'typescript',
				'test: cover degenerate bounding boxes (#414)',
				hoursAgo(20)
			),
			file(
				'tests/serialize.test.ts',
				'typescript',
				'test: add a fixture for nested groups (#401)',
				daysAgo(9)
			)
		]),
		file('.gitignore', 'text', 'chore: ignore local coverage output (#380)', daysAgo(49)),
		file('LICENSE', 'text', 'chore: bump the copyright year (#352)', daysAgo(243)),
		file('README.md', 'markdown', 'docs: rewrite the install section (#418)', minutesAgo(30)),
		file('package.json', 'json', 'chore: bump vite to 6.2 (#416)', hoursAgo(18)),
		file('tsconfig.json', 'json', 'build: turn on verbatimModuleSyntax (#393)', daysAgo(35))
	];

	/**
	 * Give every folder the newest commit beneath it — message and date together,
	 * taken from the same child so the two columns never describe different
	 * commits. Runs bottom-up, so a folder always agrees with what is inside it.
	 */
	function withRollups(nodes: RepoEntry[]): RepoEntry[] {
		return nodes.map((node) => {
			if (!node.children || node.children.length === 0) {
				return node;
			}
			const children = withRollups(node.children);
			const newest = children.reduce((latest, child) =>
				child.committedAt > latest.committedAt ? child : latest
			);
			return {
				...node,
				children,
				commitMessage: newest.commitMessage,
				committedAt: newest.committedAt
			};
		});
	}

	const ROLLED_UP = withRollups(REPO_TREE);

	const DEFAULT_EXPANDED = ['src'];

	// ============= README =============

	/*
	 * Rendered by core's `Markdown`, which parses in-house and draws through the
	 * same Heading/Text/List/CodeBlock/Table primitives the rest of the page uses
	 * — so the preview inherits the theme instead of shipping its own prose CSS.
	 */
	const README = `## canvas-editor

A small, embeddable vector canvas. Draw shapes, group them, and serialise the result to JSON that round-trips without loss.

### Install

\`\`\`bash
npm install canvas-editor
\`\`\`

### Usage

\`\`\`ts
const {Canvas} = await import('canvas-editor');

const canvas = new Canvas(document.querySelector('#root'));
canvas.add({kind: 'rect', x: 0, y: 0, width: 120, height: 80});
\`\`\`

### Status

| Area        | State    | Notes                                  |
| ----------- | -------- | -------------------------------------- |
| Rendering   | Stable   | Dirty-rect redraw, no full repaints    |
| Serialising | Stable   | Round-trips groups and nested shapes   |
| Plugins     | Beta     | API may change before 1.0              |

### Contributing

Read [the contributing guide](#) first. In short:

- One change per pull request, with a test that fails without it.
- Run \`npm test\` before pushing.
- Conventional commits — the changelog is generated from them.

> Issues tagged \`good first issue\` are a reasonable place to start.
`;

	const DOCS_README = `## Documentation

How the canvas is put together, and how to work on it.

### Start here

- **getting-started.md** — install the package and draw your first shape.
- **contributing.md** — branch naming, the release checklist, how to get review.

### Architecture

The \`architecture/\` folder covers the parts that are hard to infer from the
source: how the dirty-rect redraw path decides what to repaint, and who owns
the undo stack.
`;

	/*
	 * Which folders have a README to show. Keyed by folder id, with the empty
	 * string standing for the repo root.
	 *
	 * Whether a preview appears is decided by the tree, not by this map — a
	 * folder shows one only if it actually contains a README file. This just
	 * supplies the body for the folders that do, so the two cannot disagree
	 * about which folders have one.
	 */
	const READMES: Record<string, string> = {
		'': README,
		docs: DOCS_README
	};

	/**
	 * The README to show for the folder currently selected, or `null` when that
	 * folder has none — the file list stands on its own and the preview card is
	 * dropped rather than left empty.
	 *
	 * Ids are paths, so the folder is reached by walking its segments.
	 */
	function readmeFor(folderId: string | null): string | null {
		let entries = REPO_TREE;

		if (folderId != null) {
			for (const segment of folderId.split('/')) {
				const next: RepoEntry | undefined = entries.find(
					(entry) => entry.name === segment && entry.kind === 'folder'
				);
				if (next?.children == null) {
					return null;
				}
				entries = next.children;
			}
		}

		const hasReadme = entries.some(
			(entry) => entry.kind !== 'folder' && /^readme\.md$/i.test(entry.name)
		);
		return hasReadme ? (READMES[folderId ?? ''] ?? null) : null;
	}

	// ============= SEARCH =============

	/**
	 * Shared by `pruneTree` and `countMatches` so the rows on screen and the
	 * tally beside the search field can never disagree about what a match is.
	 */
	function isMatch(node: RepoEntry, needle: string): boolean {
		return (
			node.name.toLowerCase().includes(needle) ||
			node.commitMessage.toLowerCase().includes(needle)
		);
	}

	/**
	 * Counts only true matches. `pruneTree` also keeps ancestors, so the visible
	 * row count runs ahead of the number of things actually found.
	 */
	function countMatches(nodes: RepoEntry[], needle: string): number {
		return nodes.reduce(
			(total, node) =>
				total +
				(isMatch(node, needle) ? 1 : 0) +
				(node.children ? countMatches(node.children, needle) : 0),
			0
		);
	}

	/** Keep any branch with a match at or beneath it; drop everything else. */
	function pruneTree(nodes: RepoEntry[], needle: string): RepoEntry[] {
		const kept: RepoEntry[] = [];
		for (const node of nodes) {
			const isSelfMatch = isMatch(node, needle);
			const children = node.children ? pruneTree(node.children, needle) : [];
			if (isSelfMatch || children.length > 0) {
				kept.push(
					node.children
						? {
								...node,
								children: isSelfMatch && children.length === 0 ? node.children : children
							}
						: node
				);
			}
		}
		return kept;
	}

	function collectIds(nodes: RepoEntry[], into: Set<string>): Set<string> {
		for (const node of nodes) {
			if (node.children && node.children.length > 0) {
				into.add(node.id);
				collectIds(node.children, into);
			}
		}
		return into;
	}

	// ============= FORMATTING =============

	/*
	 * `numeric: 'auto'` is what turns a single unit into "yesterday", "last week"
	 * and "last month" instead of "1 day ago" — the phrasing a repository browser
	 * uses. The locale is pinned so the docsite's snapshots do not move with the
	 * runner's own.
	 */
	const relativeFormat = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

	// Largest first: the loop reports in the biggest unit that fits.
	const AGE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
		['year', 365 * 86_400_000],
		['month', 30 * 86_400_000],
		['week', 7 * 86_400_000],
		['day', 86_400_000],
		['hour', 3_600_000],
		['minute', 60_000]
	];

	function commitAge(epochMs: number): string {
		const elapsed = NOW - epochMs;
		for (const [unit, size] of AGE_UNITS) {
			if (elapsed >= size) {
				return relativeFormat.format(-Math.floor(elapsed / size), unit);
			}
		}
		return 'just now';
	}

	// ============= KEYBOARD =============

	/*
	 * Toolbar pads its own contents by 12px, but the table body sits on a 16px
	 * content line. The difference is added out here so the two agree.
	 */
	const headerContainer = 'padding-inline: 4px;';
	/*
	 * The wash for the selected folder.
	 *
	 * `--color-background-blue`, not `--color-accent-muted`: the theme in use
	 * neutralises the accent family to grey (#f1f1f1 light, #262626 dark), so an
	 * accent wash would be invisible against the zebra stripe. The categorical
	 * colours are left chromatic on purpose, which is what makes this read blue.
	 *
	 * Painted as an inset shadow rather than a background so it survives the
	 * zebra stripe, which sets `background-color` on this same row and would
	 * otherwise replace it.
	 */
	const selectedRow = 'box-shadow: inset 0 0 0 100vmax var(--color-background-blue);';
	// Inside the TabList so its divider border keeps spanning the whole card.
	const readmeTabs = 'padding-inline: 4px;';

	/** Header width below which the view switcher and search give up their space. */
	const NARROW_HEADER = 720;

	/**
	 * How many crumbs stay inline before the middle folds into a menu. Three
	 * keeps the repo, the parent and the current folder — one more than that and
	 * the trail starts competing with the rest of the toolbar for the row.
	 */
	const MAX_INLINE_CRUMBS = 3;

	/** Stands in for the folded-away crumbs while mapping over the trail. */
	const ELLIPSIS = Symbol('ellipsis');

	/** One entry in the header trail. `id` is null for the repository root. */
	interface Crumb {
		label: string;
		id: string | null;
	}

	interface TreeKeyboardNavConfig {
		/** The flattened, currently visible rows, in render order. */
		rows: ReadonlyArray<RepoEntry>;
		focusedId: string | null;
		onFocusedIdChange: (id: string) => void;
		expandedIds: ReadonlySet<string>;
		onExpand: (id: string) => void;
		onCollapse: (id: string) => void;
		/** The folder whose contents the header trail is describing, if any. */
		selectedId: string | null;
	}

	/**
	 * APG treegrid keys over the visible rows: Up/Down move, Right expands then
	 * descends, Left collapses then ascends, Home/End jump to the ends.
	 *
	 * Roving `tabIndex` means the table is one tab stop; once inside, the arrows
	 * own the movement. Focus itself is moved by the page effect that watches
	 * `focusedId`, not from here, so a click and a keypress converge on one path.
	 */
	function treeKeyboardNav(config: TreeKeyboardNavConfig): TablePlugin<RepoEntry> {
		const { rows, focusedId, onFocusedIdChange, expandedIds, onExpand, onCollapse, selectedId } =
			config;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || rows.length === 0) {
				return;
			}
			const index = rows.findIndex((row) => row.id === focusedId);
			const current = index >= 0 ? rows[index] : undefined;
			const hasChildren = Boolean(current?.children?.length);
			const isExpanded = current != null && expandedIds.has(current.id);

			let nextId: string | undefined;

			switch (event.key) {
				case 'ArrowDown':
					nextId = rows[index + 1]?.id ?? rows[0]?.id;
					break;
				case 'ArrowUp':
					nextId = index > 0 ? rows[index - 1].id : rows[0]?.id;
					break;
				case 'ArrowRight':
					if (current == null) {
						nextId = rows[0]?.id;
					} else if (hasChildren && !isExpanded) {
						onExpand(current.id);
					} else if (hasChildren) {
						// Already open, so Right descends to the first child.
						nextId = rows[index + 1]?.id;
					}
					break;
				case 'ArrowLeft':
					if (current == null) {
						nextId = rows[0]?.id;
					} else if (hasChildren && isExpanded) {
						onCollapse(current.id);
					} else {
						// Ids are paths, so the parent is a prefix of this row's id.
						const cut = current.id.lastIndexOf('/');
						const parentId = cut > 0 ? current.id.slice(0, cut) : undefined;
						nextId = rows.find((row) => row.id === parentId)?.id;
					}
					break;
				case 'Home':
					nextId = rows[0]?.id;
					break;
				case 'End':
					nextId = rows[rows.length - 1]?.id;
					break;
				default:
					return;
			}

			// Every branch above either moved focus or toggled a row, so the arrow
			// key must not also scroll the page.
			event.preventDefault();
			if (nextId != null && nextId !== focusedId) {
				onFocusedIdChange(nextId);
			}
		};

		return {
			transformTable: (props) => ({
				...props,
				htmlProps: { ...props.htmlProps, onkeydown: handleKeyDown }
			}),
			transformBodyRow: (props, item) => ({
				...props,
				htmlProps: {
					...props.htmlProps,
					/*
					 * The selected folder is washed rather than outlined, so the
					 * row still reads as part of the list. The tint rides on this
					 * plugin because it owns the only `transformBodyRow` in the
					 * bag — a second plugin transforming the same row would have
					 * to be merged by hand.
					 */
					style: [props.htmlProps.style, item.id === selectedId ? selectedRow : '']
						.filter(Boolean)
						.join(' '),
					/*
					 * Roving tabindex: one stop for the whole table. Selection and
					 * the cursor are separate — the cursor is wherever the arrows
					 * left off, the selection is the folder the header trail is
					 * describing.
					 */
					tabindex: item.id === focusedId ? 0 : -1,
					'data-row-id': item.id,
					'aria-selected': item.id === selectedId ? true : undefined,
					onclick: () => onFocusedIdChange(item.id)
				}
			})
		};
	}

	// ============= COLUMNS =============

	/*
	 * A factory, not a constant: the name cell has to reach the handler that
	 * moves the trail in the header, and that handler only exists inside the
	 * page component.
	 */
	function buildColumns(onSelectFolder: (id: string) => void): TableColumn<RepoEntry>[] {
		return [
			{
				key: 'name',
				header: 'Name',
				// Deep rows spend their width on indentation before the name even
				// starts, so this column needs a floor well above the 120px default.
				width: proportional(2, { minWidth: 240 }),
				sortable: true,
				renderCell: nameCell
			},
			{
				// Subject lines are long and vary a lot, so this column takes the slack
				// rather than truncating at a width picked in advance.
				key: 'message',
				header: 'Last commit message',
				width: proportional(3, { minWidth: 200 }),
				sortable: true,
				renderCell: messageCell
			},
			{
				key: 'committed',
				header: 'Last commit date',
				width: pixel(160),
				align: 'end',
				sortable: true,
				renderCell: dateCell
			}
		];
	}

	// ============= REPO CHROME =============

	/*
	 * The supporting detail around the file list. None of it is interactive here —
	 * it exists so the table is read in the context a real repository gives it,
	 * and so the layout is exercised at its true density rather than with a bare
	 * table floating in an empty page.
	 */

	const REPO_DESCRIPTION =
		'A small, embeddable vector canvas. Draw shapes, group them, and serialise the result to JSON that round-trips without loss.';

	const TOPICS = [
		'canvas',
		'vector-graphics',
		'typescript',
		'editor',
		'svg',
		'2d-graphics',
		'wasm'
	];

	const ABOUT_LINKS = [
		{ label: 'Readme', icon: BookOpen },
		{ label: 'MIT license', icon: Scale },
		{ label: 'Code of conduct', icon: ShieldCheck },
		{ label: 'Security policy', icon: ShieldCheck },
		{ label: 'Activity', icon: ChartColumn }
	];

	/** The count reads as a noun; the button beside it has to read as a verb. */
	const STAT_ACTION: Record<string, string> = {
		stars: 'Star',
		watching: 'Watch',
		forks: 'Fork'
	};

	/*
	 * The two ref counts beside the branch selector. Tag rather than Tags: the
	 * plural glyph reads as a stack at 16px, which is noise next to a branch icon
	 * that is already busy.
	 */
	const REF_COUNTS = [
		{ label: '171 Branches', icon: GitBranch },
		{ label: '56 Tags', icon: Tag }
	];

	const REPO_STATS = [
		{ label: 'stars', value: '12.6k', icon: Star },
		{ label: 'watching', value: '97', icon: Eye },
		{ label: 'forks', value: '1.3k', icon: GitFork }
	];

	const CONTRIBUTORS = [
		'Ada Okafor',
		'Bo Lindqvist',
		'Cass Moreau',
		'Dev Raman',
		'Elif Aydın',
		'Finn Ashworth',
		'Gia Petrova',
		'Hana Sato',
		'Ines Duarte',
		'Jo Mbeki',
		'Kit Nakamura',
		'Lena Voss'
	];

	/*
	 * The other three tabs exist to show the shape of the control; a template that
	 * shipped four full documents would be teaching markdown, not layout.
	 */
	const TAB_PLACEHOLDER = {
		conduct: 'The Contributor Covenant, version 2.1, applies to this project.',
		license: 'MIT. Do what you like, keep the notice, expect no warranty.',
		security: 'Report vulnerabilities privately through a security advisory.'
	};

	// ============= PAGE STATE =============

	const idPrefix = $props.id();
	const searchId = `${idPrefix}-search`;

	let query = $state('');
	let manualExpandedIds = $state<ReadonlySet<string>>(new Set(DEFAULT_EXPANDED));
	let focusedId = $state<string | null>(null);
	let selectedFolderId = $state<string | null>(null);
	let columnWidths = $state<Record<string, number>>({});
	let isSearchOpen = $state(false);

	/*
	 * Two regions, two numbers. The header spans the whole page, so it is what
	 * decides whether the repo actions keep their labels. The branch bar sits in
	 * the content column beside the sidebar and can be far narrower than the
	 * page — measuring the header for it would leave the search field expanded
	 * in a column that cannot hold it.
	 */
	let headerEl: HTMLElement | null = $state(null);
	let headerWidth = $state<number | null>(null);
	const isNarrowHeader = $derived(headerWidth != null && headerWidth <= NARROW_HEADER);

	$effect(() => {
		const element = headerEl;
		if (element == null) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			headerWidth = entries[0].contentRect.width;
		});
		observer.observe(element);
		return () => observer.disconnect();
	});

	let bodyEl: HTMLElement | null = $state(null);
	let bodyWidth = $state<number | null>(null);
	const isNarrowBody = $derived(bodyWidth != null && bodyWidth <= NARROW_HEADER);

	$effect(() => {
		const element = bodyEl;
		if (element == null) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			bodyWidth = entries[0].contentRect.width;
		});
		observer.observe(element);
		return () => observer.disconnect();
	});

	/*
	 * Below this the sidebar would starve the table — 296px off an already short
	 * page leaves the commit column clipped. It moves under the README instead,
	 * which is where GitHub puts it at the same size.
	 */
	const isSidebarInline = useMediaQuery(() => '(min-width: 1024px)');

	/*
	 * The field is only hidden, never unmounted, so `hasAutoFocus` would not
	 * fire on the way back in — the button reveals an existing element rather
	 * than mounting a new one.
	 */
	$effect(() => {
		if (isSearchOpen) {
			document.getElementById(searchId)?.focus();
		}
	});

	/*
	 * Collapsing with a query still applied would hide the reason the tree is
	 * pruned, so an empty field is the only way back to the button. Bound
	 * natively because blur does not bubble and TextInput takes no `onBlur`.
	 */
	$effect(() => {
		const input = document.getElementById(searchId);
		if (input == null) {
			return;
		}
		const collapseIfEmpty = () => {
			if (query === '') {
				isSearchOpen = false;
			}
		};
		input.addEventListener('blur', collapseIfEmpty);
		return () => input.removeEventListener('blur', collapseIfEmpty);
		// `isSearchOpen` mounts and unmounts the field, so the listener has to be
		// rebound onto whichever element is currently there.
	});

	const needle = $derived(query.trim().toLowerCase());
	const isSearching = $derived(needle.length > 0);

	// Pruning changes what a folder contains, so the rollups have to be
	// recomputed from the survivors. Reusing the unpruned totals would leave a
	// folder claiming more bytes than the files visible underneath it add up to.
	const data = $derived(isSearching ? withRollups(pruneTree(ROLLED_UP, needle)) : ROLLED_UP);

	// While searching, expansion is derived from the pruned tree so no match can
	// hide behind a collapsed parent; manual state is parked, not overwritten.
	const searchExpandedIds = $derived(isSearching ? collectIds(data, new Set<string>()) : null);
	const expandedIds = $derived(searchExpandedIds ?? manualExpandedIds);

	const sortable = useTableSortableState<RepoEntry>(() => ({
		data,
		comparators: {
			// Folders first, then by name — the ordering every repo browser uses.
			name: (a, b) =>
				Number(b.kind === 'folder') - Number(a.kind === 'folder') ||
				a.name.localeCompare(b.name),
			message: (a, b) => a.commitMessage.localeCompare(b.commitMessage),
			committed: (a, b) => a.committedAt - b.committedAt
		}
	}));

	const tree = useTableTreeState<RepoEntry>(() => ({
		data,
		idKey: 'id',
		expandedIds,
		onExpandedIdsChange: isSearching ? () => {} : (ids) => (manualExpandedIds = ids),
		// Reorders each sibling group in place, so children never leave their
		// parent — this is what keeps sorting and hierarchy compatible.
		sortSiblings: sortable.applySort
	}));

	const setExpanded = (id: string, shouldExpand: boolean) => {
		if (isSearching) {
			return;
		}
		const next = new Set(manualExpandedIds);
		if (shouldExpand) {
			next.add(id);
		} else {
			next.delete(id);
		}
		manualExpandedIds = next;
	};

	const expandRow = (id: string) => setExpanded(id, true);
	const collapseRow = (id: string) => setExpanded(id, false);

	/*
	 * Selecting a folder is what the header trail reads from. Ids are paths, so
	 * the trail is the id split on '/' — there is no second structure to keep in
	 * step with the tree.
	 */
	const selectFolder = (id: string) => {
		selectedFolderId = id;
		// Selecting a folder you cannot see into is a dead end, so open it.
		setExpanded(id, true);
	};

	/*
	 * The header trail, root first. Ids are paths, so each crumb's target is just
	 * the prefix up to that segment — there is no second structure to keep in
	 * step with the tree.
	 */
	const crumbs = $derived.by((): Crumb[] => {
		const segments = selectedFolderId == null ? [] : selectedFolderId.split('/');
		return [
			{ label: ROOT_NAME, id: null },
			...segments.map((segment, index) => ({
				label: segment,
				id: segments.slice(0, index + 1).join('/')
			}))
		];
	});

	/*
	 * Keep the first crumb and the last two; everything between them goes to the
	 * menu. The first is the repo, the last is where you are, and the one before
	 * it is the usual "up one level" target — those three carry almost all the
	 * navigation, so the middle is what can afford to fold away.
	 */
	const hiddenCrumbs = $derived(
		crumbs.length > MAX_INLINE_CRUMBS ? crumbs.slice(1, crumbs.length - 2) : []
	);

	const collapsedCrumbs = $derived<Array<Crumb | typeof ELLIPSIS>>(
		hiddenCrumbs.length === 0
			? crumbs
			: [crumbs[0], ELLIPSIS, ...crumbs.slice(crumbs.length - 2)]
	);

	const columns = $derived.by<TableColumn<RepoEntry>[]>(() => buildColumns(selectFolder));

	const readme = $derived(readmeFor(selectedFolderId));
	const readmeBody = $derived(readme ?? '');
	const readmeHasRepoTabs = $derived(selectedFolderId == null);
	let readmeTab = $state('readme');

	// Focus follows `focusedId`, whether it moved by arrow key or by click, so
	// there is one path to keep the roving tabindex and the DOM in agreement.
	let shouldFocus = false;
	const moveFocus = (id: string) => {
		shouldFocus = true;
		focusedId = id;
	};

	$effect(() => {
		if (!shouldFocus || focusedId == null || bodyEl == null) {
			return;
		}
		shouldFocus = false;
		bodyEl
			.querySelector<HTMLElement>(`tr[data-row-id="${CSS.escape(focusedId)}"]`)
			?.focus();
	});

	const treePlugin = useTableTreeData<RepoEntry>(() => ({
		...tree.treeConfig,
		hasExpandAllControl: true
	}));
	const sort = useTableSortable<RepoEntry>(() => sortable.sortConfig);
	const resize = useTableColumnResize<RepoEntry>(() => ({
		columnWidths,
		onColumnResizeEnd: (updates) => (columnWidths = { ...columnWidths, ...updates }),
		columns: columns as TableColumn<Record<string, unknown>>[]
		/*
		 * No global `minWidth` on purpose: it takes precedence over every column's
		 * own floor, so setting one here would flatten Name's 240px down to a
		 * single shared number. Each column carries its own instead — the fixed
		 * ones floor at their declared width, Name at the minimum that still fits
		 * an indented filename.
		 */
	}));
	const keyboard = $derived(
		treeKeyboardNav({
			rows: tree.visibleData,
			focusedId,
			onFocusedIdChange: moveFocus,
			expandedIds,
			onExpand: expandRow,
			onCollapse: collapseRow,
			selectedId: selectedFolderId
		})
	);

	const matchCount = $derived(isSearching ? countMatches(ROLLED_UP, needle) : 0);
</script>

<!-- ============= TABLE CELLS ============= -->

{#snippet nameCell(entry: RepoEntry)}
	<HStack gap={2} vAlign="center">
		<Icon
			icon={KIND_ICON[entry.kind]}
			size="sm"
			color={entry.kind === 'folder' ? 'accent' : 'secondary'}
			fill={entry.kind === 'folder' ? 'currentColor' : 'none'}
		/>
		{#if entry.kind === 'folder'}
			<!--
				A folder is a place rather than a document, so activating it selects
				it and the header trail follows. The href is what makes it a link
				for the keyboard and the context menu; the default is suppressed
				because nothing is actually fetched.
			-->
			<Link
				href="#"
				onclick={(event) => {
					event.preventDefault();
					selectFolder(entry.id);
				}}
			>
				{entry.name}
			</Link>
		{:else}
			<Link href="#">{entry.name}</Link>
		{/if}
	</HStack>
{/snippet}

{#snippet messageCell(entry: RepoEntry)}
	<Text color="secondary">{entry.commitMessage}</Text>
{/snippet}

{#snippet dateCell(entry: RepoEntry)}
	<Text color="secondary">{commitAge(entry.committedAt)}</Text>
{/snippet}

<!-- ============= REPO CHROME ============= -->

{#snippet aboutPanel()}
	<VStack gap={6}>
		<VStack gap={3}>
			<Heading level={3}>About</Heading>
			<Text color="secondary">{REPO_DESCRIPTION}</Text>
			<Link href="#" isExternalLink>canvas-editor.dev</Link>
			<!--
				Topics are chips you can click, which rules out Badge — its docs
				name clickable badges as an anti-pattern. Token is the chip that
				takes an onClick and paints a hover state to match.
			-->
			<HStack gap={1} wrap="wrap">
				{#each TOPICS as topic (topic)}
					<Token size="sm" label={topic} onclick={() => {}} />
				{/each}
			</HStack>
			<!--
				Not a List. ListItem is a row with its own inline padding and hit
				area, so it hangs its text further in than the description, the
				topics and the stats above it — the one thing this column needs is
				a single left edge. An icon beside a Link starts where they start.
			-->
			<VStack gap={2}>
				{#each ABOUT_LINKS as link (link.label)}
					<HStack gap={2} vAlign="center">
						<Icon icon={link.icon} size="sm" color="secondary" />
						<Link href="#">{link.label}</Link>
					</HStack>
				{/each}
			</VStack>
			<!--
				Same row shape as the links above: one per line, icon at sm beside a
				default-size Link. These used to be supporting-size with the count
				bolded and the three of them wrapping two-then-one, which read as a
				different kind of thing sitting in the middle of the same column.
			-->
			<VStack gap={2}>
				{#each REPO_STATS as stat (stat.label)}
					<HStack gap={2} vAlign="center">
						<Icon icon={stat.icon} size="sm" color="secondary" />
						<Link href="#">{stat.value} {stat.label}</Link>
					</HStack>
				{/each}
			</VStack>
		</VStack>

		<Divider />

		<VStack gap={3}>
			<Heading level={3}>Releases</Heading>
			<HStack gap={2} vAlign="center">
				<Icon icon={Tag} size="sm" color="success" />
				<Text weight="bold">v2.4.0</Text>
				<Badge label="Latest" variant="success" />
			</HStack>
			<Text type="supporting" color="secondary">
				{commitAge(daysAgo(11))} · 36 releases
			</Text>
		</VStack>

		<Divider />

		<VStack gap={3}>
			<Heading level={3}>Contributors</Heading>
			<!--
				AvatarGroup overlaps its children by design, which fights a
				wrapping grid — so this is a plain wrapped row of avatars, which is
				the shape GitHub uses and the shape the group's own docs point you
				to here.
			-->
			<HStack gap={1} wrap="wrap">
				{#each CONTRIBUTORS as name (name)}
					<Avatar {name} size={32} />
				{/each}
			</HStack>
			<Link href="#">+ 61 contributors</Link>
		</VStack>
	</VStack>
{/snippet}

{#snippet branchIcon()}
	<Icon icon={GitBranch} size="sm" />
{/snippet}

{#snippet searchIcon()}
	<Icon icon={Search} size="sm" />
{/snippet}

{#snippet codeIcon()}
	<Icon icon={Code} size="sm" />
{/snippet}

<!--
	The bar between the repo header and the file list: which ref you are looking
	at on the left, and what you can do with it on the right.
-->
{#snippet branchBar()}
	<!--
		One height for the whole row. Toolbar gets this by wrapping its slots in a
		SizeProvider, and this bar is a plain HStack, so it does the same. Button
		and TextInput read the context; IconButton and DropdownMenu do not, so
		those two are told directly — DropdownMenu takes it on its `button`
		object, where it otherwise defaults to `md`.
	-->
	<SizeProvider value="sm">
		<HStack gap={2} vAlign="center" wrap="wrap">
			<DropdownMenu
				button={{ label: 'main', size: 'sm', icon: branchIcon }}
				hasChevron
				items={[
					{ label: 'main', onClick: () => {} },
					{ label: 'next', onClick: () => {} },
					{ type: 'divider' },
					{ label: 'View all branches', onClick: () => {} }
				]}
			/>
			<!--
				Ghost is the flat variant — no fill, no border. The count and the
				noun ride in one `label` because Button takes a string, so the
				number cannot be bolded separately the way it is in the stats row.

				These drop to icons at the same width where the search field
				collapses. `label` carries the full "171 Branches" in both forms, so
				what a screen reader hears does not change with the viewport — only
				whether the text is painted alongside the glyph.
			-->
			<HStack gap={1} vAlign="center">
				{#each REF_COUNTS as ref (ref.label)}
					{#snippet refIcon()}
						<Icon icon={ref.icon} size="sm" />
					{/snippet}
					{#if isNarrowBody}
						<IconButton
							variant="ghost"
							size="sm"
							icon={refIcon}
							label={ref.label}
							onclick={() => {}}
						/>
					{:else}
						<Button variant="ghost" size="sm" label={ref.label} onclick={() => {}} />
					{/if}
				{/each}
			</HStack>
			<StackItem size="fill">
				<HStack gap={2} hAlign="end" vAlign="center">
					{#if isSearching && matchCount > 0}
						<Text type="supporting" color="secondary">
							{matchCount}
							{matchCount === 1 ? 'result' : 'results'}
						</Text>
					{/if}
					{#if isNarrowBody && !isSearchOpen}
						<IconButton
							variant="ghost"
							size="sm"
							icon={searchIcon}
							label="Go to file"
							onclick={() => (isSearchOpen = true)}
						/>
					{:else}
						<TextInput
							id={searchId}
							label="Go to file"
							isLabelHidden
							placeholder="Go to file"
							startIcon={searchIcon}
							value={query}
							onChange={(value: string) => (query = value)}
							hasClear
						/>
					{/if}
					<DropdownMenu
						button={{ label: 'Add file', size: 'sm' }}
						hasChevron
						items={[
							{ label: 'Create new file', onClick: () => {} },
							{ label: 'Upload files', onClick: () => {} }
						]}
					/>
					<Button label="Code" variant="primary" icon={codeIcon} />
				</HStack>
			</StackItem>
		</HStack>
	</SizeProvider>
{/snippet}

<!-- ============= README ============= -->

<!--
	The repository's own documentation, under the file list.

	The tabs swap content in place rather than navigating, so they are a real
	`role="tablist"` and each `Tab` names the panel it controls. `Markdown` takes
	`headingLevelStart={2}` because the page's h1 is the repository name up in the
	header — leaving it at 1 would put a second top-level heading in the outline
	for what is really a section of this page.
-->
{#snippet readmePanel()}
	{@const activeTab = readmeHasRepoTabs ? readmeTab : 'readme'}
	<Card padding={0}>
		<!--
			`hasDivider` is a border on the TabList itself, so the inset has to go
			inside it: padding moves the tabs in 4px while the border still runs the
			full width of the card. Putting that padding on the Section instead
			would carry the rule in with it and stop it short at both ends.
		-->
		<Section variant="transparent" padding={0} paddingBlock={1}>
			<TabList
				value={activeTab}
				onChange={(value: string) => (readmeTab = value)}
				role="tablist"
				size="sm"
				hasDivider
				style={readmeTabs}
			>
				<Tab value="readme" label="Readme" panelId="repo-readme" />
				{#if readmeHasRepoTabs}
					<Tab value="conduct" label="Code of conduct" panelId="repo-conduct" />
				{/if}
				{#if readmeHasRepoTabs}
					<Tab value="license" label="MIT license" panelId="repo-license" />
				{/if}
				{#if readmeHasRepoTabs}
					<Tab value="security" label="Security" panelId="repo-security" />
				{/if}
			</TabList>
		</Section>
		<Section variant="transparent" padding={6} id={`repo-${activeTab}`}>
			{#if activeTab === 'readme'}
				<!--
					Prose already caps at Markdown's default 680px measure; centring
					it stops that column hugging the left edge of a much wider card.
				-->
				<Markdown headingLevelStart={2} contentAlign="center" children={readmeBody} />
			{:else}
				<Text color="secondary">
					{TAB_PLACEHOLDER[activeTab as keyof typeof TAB_PLACEHOLDER]}
				</Text>
			{/if}
		</Section>
	</Card>
{/snippet}

{#snippet header()}
	<Toolbar
		label="Repository"
		size="sm"
		dividers={['bottom']}
		style={headerContainer}
		{@attach (element) => {
			headerEl = element as HTMLElement;
		}}
		startContent={headerStart}
		endContent={headerEnd}
	/>
{/snippet}

{#snippet headerStart()}
	<HStack gap={2} vAlign="center">
		<!--
			The repo name is the first crumb rather than a heading sitting beside
			the trail. As a heading it was 17px against the segments' 14px, so
			selecting a folder put two type sizes on one line; as a crumb it cannot
			drift from them. The page still owes the outline an h1, which no longer
			has anything to attach to, so it is supplied for assistive tech only.
		-->
		<VisuallyHidden>
			<Heading level={1}>{ROOT_NAME}</Heading>
		</VisuallyHidden>
		<Breadcrumbs label="Folder path">
			<!--
				Breadcrumbs wraps rather than truncates when it runs out of room,
				which in a single-row toolbar pushes the whole header taller. Past
				MAX_INLINE_CRUMBS the middle folds into a menu on a "…" item, so
				the trail keeps its height and the ends — the repo you are in and
				the folder you are looking at — stay visible, which are the two you
				navigate from.
			-->
			{#each collapsedCrumbs as crumb, index (crumb === ELLIPSIS ? 'ellipsis' : (crumb.id ?? ROOT_NAME))}
				{#if crumb === ELLIPSIS}
					<BreadcrumbItem
						menu={hiddenCrumbs.map((hidden) => ({
							label: hidden.label,
							onClick: () => (selectedFolderId = hidden.id)
						}))}
					>
						&hellip;
					</BreadcrumbItem>
				{:else}
					<BreadcrumbItem
						isCurrent={index === collapsedCrumbs.length - 1}
						onclick={index === collapsedCrumbs.length - 1
							? undefined
							: () => (selectedFolderId = crumb.id)}
					>
						{crumb.label}
					</BreadcrumbItem>
				{/if}
			{/each}
		</Breadcrumbs>
		<!--
			Badge has no outline variant, so GitHub's grey-ringed pill is a filled
			neutral one here. It is also read-only by contract, which suits a
			status word that is not a control.
		-->
		<Badge label="Public" variant="neutral" />
	</HStack>
{/snippet}

{#snippet headerEnd()}
	<!--
		GitHub's three social counts. The leading slot on Button is `icon`, not
		`startContent`, and `endContent` is documented to take a Badge — which is
		exactly the attached-count shape. Narrow drops the labels rather than
		wrapping the row.
	-->
	{#each REPO_STATS as stat (stat.label)}
		{#snippet statIcon()}
			<Icon icon={stat.icon} size="sm" />
		{/snippet}
		{#snippet statBadge()}
			<Badge label={stat.value} />
		{/snippet}
		{#if isNarrowHeader}
			<IconButton
				variant="secondary"
				size="sm"
				icon={statIcon}
				label={`${stat.label}: ${stat.value}`}
				onclick={() => {}}
			/>
		{:else}
			<Button
				size="sm"
				label={STAT_ACTION[stat.label]}
				icon={statIcon}
				endContent={statBadge}
			/>
		{/if}
	{/each}
{/snippet}

{#snippet emptyStateActions()}
	<Button label="Clear search" variant="secondary" onclick={() => (query = '')} />
{/snippet}

{#snippet mainContent()}
	<LayoutContent padding={4}>
		{#if data.length === 0}
			<EmptyState
				title="No matching files"
				description="No file or folder in this project matches your search."
				actions={emptyStateActions}
			/>
		{:else}
			<VStack
				gap={6}
				{@attach (element) => {
					bodyEl = element as HTMLElement;
				}}
			>
				{@render branchBar()}
				<!--
					The file list reads as one bounded object, the way GitHub boxes
					it. `padding={0}` matters twice: it lets rows reach the border so
					the zebra stripes are full-bleed inside the card, and it zeroes
					the container padding variables that Table's own edge-bleed
					subtracts from its margins.
				-->
				<Card padding={0}>
					<Table
						data={tree.visibleData}
						{columns}
						idKey="id"
						density="compact"
						dividers="none"
						isStriped
						textOverflow="truncate"
						plugins={{ tree: treePlugin, sort, resize, keyboard }}
					/>
				</Card>
				{#if readme != null}
					{@render readmePanel()}
				{/if}
				<!--
					Same panel, different slot: once the layout drops the sidebar the
					metadata is not discarded, it just stacks under the file list and
					its README the way it does on a phone.
				-->
				{#if !isSidebarInline.matches}
					<Divider />
					{@render aboutPanel()}
				{/if}
			</VStack>
		{/if}
	</LayoutContent>
{/snippet}

{#snippet endPanel()}
	<LayoutPanel
		width={296}
		padding={4}
		role="complementary"
		label="About this repository"
		isScrollable={false}
	>
		{@render aboutPanel()}
	</LayoutPanel>
{/snippet}

<!--
	`fill` — the default — pins the layout to the viewport and scrolls the content
	area internally, which would trap the README below the fold with no way to
	reach it. `auto` lets the page itself scroll.

	Past 1440 the commit column strands its date miles from its message. Layout
	centres each slot inside the cap and leaves dividers full-bleed, so the page
	keeps its edge-to-edge rules on a wide screen.
-->
<Layout
	height="auto"
	contentWidth={1440}
	end={isSidebarInline.matches ? endPanel : undefined}
	{header}
	content={mainContent}
/>
