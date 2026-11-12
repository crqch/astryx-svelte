<!--
	Ported from upstream's `assets/templates/pages/canvas-editor/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Lucide throughout, as upstream's are: `@lucide/svelte` is
	`lucide-react`'s Svelte build and keeps the names, so the import below is
	upstream's with the package name changed.

	## The theme

	`defineTheme` and `Theme` are upstream's, transcribed value for value. The
	artboard's theme is mounted narrowly around the poster with `mode="light"` so
	the poster holds when the editor goes dark, and the hue rail mounts the same
	theme so only its track takes the rainbow gradient.

	## The translations

	1. **StyleX is gone; the styles are ordinary CSS.** Every `stylex.create` rule
	   is a class in the `<style>` block at the bottom (or an inline `style` string
	   when it interpolates a value). The classes are `ce-`-prefixed and written
	   `:global(...)`, because most of them land on Astryx components — a class
	   handed to a component is never scoped by Svelte, so a scoped rule for it
	   would be dropped as unused (the hazard `port/ledger/022` records). The
	   enumerable type sets (`typeCase`, `typeLine`, `typeSlant`, `typeAlign`) are
	   inline declarations in `textDecorations`, which is what the artboard needs.

	2. **`useContainerReveal` became row-hover CSS.** The hook's Svelte port hands
	   out `{class, style}` for a container and its content, and
	   `TreeListItemData` has no class/style seam to carry the container half — so
	   the reveal is expressed against the row classes Astryx already publishes
	   (`astryx-item`, `astryx-tree-list-item`): hidden at rest, shown on
	   `:hover`/`:focus-within`, always shown on coarse pointers and when pinned
	   (the active tab, a locked layer). The behaviour the hook guarantees —
	   keyboard reachable, never `display: none`, touch never hover-gated — is
	   kept.

	3. **`ColorPicker` state lives on the page, keyed by swatch.** A snippet
	   cannot own state, and each swatch's picker keeps an HSV value from the
	   moment it opens (hex has no hue once the colour reaches black or white,
	   which is why upstream stores it). `pickers` is a record keyed by the
	   swatch's name, with the same seed-from-value and commit-on-change rules.

	4. **`GLYPH` is four snippets, not a component factory.** A page template is
	   one file, so the inline SVG letterforms are `{#snippet glyphX()}` and
	   friends. `NumberInput.startIcon` is a `Snippet` here (upstream's is an icon
	   component), so the axis fields pass those snippets and the padding fields
	   pass snippets wrapping the Lucide glyphs.

	5. **`controlXstyle` has no counterpart.** The two places upstream uses it
	   (`NumberInput.controlXstyle` for the filter read-out, `Selector.controlXstyle`
	   for the zoom control) become the equal `width` props — the same visible box,
	   applied to the field root rather than its inner control.

	6. **`useResizable` config keys are the port's** (`minSizePx`/`maxSizePx`
	   rather than `minSize`/`maxSize`); the values are upstream's.

	7. **The hidden file input is upstream's own arrangement**, kept: upstream
	   drives the picker from the `Thumbnail` because Astryx's `FileInput` is fixed
	   at the medium element height and this inspector is built on a 28px rhythm.
	   The input's ref becomes an id.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		AspectRatio,
		Card,
		Center,
		Divider,
		DropdownMenu,
		DropdownMenuCheckboxItem,
		DropdownMenuDivider,
		DropdownMenuItem,
		DropdownMenuRadioGroup,
		DropdownMenuRadioItem,
		DropdownMenuSubMenu,
		HStack,
		Heading,
		Icon,
		IconButton,
		Item,
		Layout,
		LayoutContent,
		LayoutFooter,
		LayoutHeader,
		LayoutPanel,
		List,
		NumberInput,
		Popover,
		ResizeHandle,
		Section,
		SegmentedControl,
		SegmentedControlItem,
		Selector,
		Slider,
		StackItem,
		Text,
		TextArea,
		TextInput,
		Thumbnail,
		Theme,
		Toolbar,
		TreeList,
		VStack,
		useResizable,
		type ThemeMode,
		type TreeListItemData
	} from '@astryx-sv/core';
	import { defineTheme } from '@astryx-sv/core/theme';
	import { neutralTheme } from '@astryx-sv/theme-neutral';
	import {
		Aperture,
		ArrowDownToLine,
		ArrowUpToLine,
		Baseline,
		CaseLower,
		CaseSensitive,
		CaseUpper,
		Contrast,
		Download,
		// Aliased: a bare `File` would shadow the DOM type the image picker reads.
		File as FileIcon,
		FlipHorizontal2,
		FlipVertical2,
		FoldVertical,
		Frame,
		Grip,
		Group,
		Image as ImageIcon,
		Italic,
		Lock,
		LockOpen,
		Menu,
		Minus,
		PanelBottom,
		PanelLeft,
		PanelLeftRightDashed,
		PanelRight,
		PanelTopBottomDashed,
		Plus,
		Redo2,
		RotateCcw,
		RotateCw,
		Scan,
		SquareRoundCorner,
		SquareSquare,
		Strikethrough,
		TextAlignCenter,
		TextAlignEnd,
		TextAlignJustify,
		TextAlignStart,
		// The angle mark for the Rotation field. Not `Angle`: that landed in
		// lucide after the version this repo pins, and a template has to build
		// against the pack the consumer actually gets.
		TriangleRight,
		Type,
		Underline,
		Undo2,
		X
	} from '@lucide/svelte';

	// =============================================================================
	// Canvas editor theme
	// =============================================================================

	/**
	 * The template keeps its visual overrides in one theme. The artboard is
	 * artwork, not app chrome, so that theme is mounted around it with a heavy
	 * condensed display face, poster-scale type, and a light palette pinned with
	 * `mode="light"` so the poster holds when the editor goes dark.
	 *
	 * The theme owns what belongs to the poster as a whole — the face, the
	 * leading, the uppercase treatment, the frame margins. Per-layer size and
	 * tracking are not here: those belong to a layer, and the inspector edits
	 * them.
	 *
	 * Sizes here are artboard pixels, not screen pixels. The artboard always lays
	 * out at its native 1080 x 1920 and the zoom control scales the whole frame,
	 * so these stay the numbers a designer would type into the inspector.
	 */
	const canvasEditorTheme = defineTheme({
		name: 'canvas-editor',
		typography: {
			// Anton is the reference face. It and the fallbacks are all
			// single-weight blacks, so display-1 stays at weight 400 and the
			// poster needs no webfont. Order matters: Impact outranks Arial
			// Narrow because Arial Narrow at 400 renders thin, which reads
			// nothing like a poster.
			heading: {
				family: 'Anton',
				fallbacks: 'Haettenschweiler, Impact, "Arial Narrow", sans-serif'
			}
		},
		tokens: {
			'--text-display-1-leading': '1.02',
			// The two spacing steps the poster lockup uses: the frame margin and
			// the gap under the eyebrow.
			'--spacing-6': '56px',
			'--spacing-3': '24px'
		},
		components: {
			heading: { 'type:display-1': { textTransform: 'uppercase' } },
			text: { 'type:supporting': { textTransform: 'uppercase' } },
			// The hue rail is a Slider whose track is the only custom paint.
			// Keeping the override in this template's one theme avoids a
			// component-only theme; the theme is mounted narrowly where the hue
			// control and poster need it.
			'slider-track': {
				base: {
					backgroundImage:
						'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
				}
			}
		}
	});

	// =============================================================================
	// Document
	// =============================================================================

	/** Artboard size in design pixels — a 9:16 social poster. */
	const FRAME = { width: 1080, height: 1920 };

	/**
	 * Every icon on this page is 16px.
	 *
	 * Icon's own scale runs 12/16/20/24, and a page that mixes them reads as
	 * drift rather than hierarchy: the rail's layer marks, the inspector's
	 * buttons, and the canvas tools are all the same rank of thing. Button sizes
	 * its icon slot to 16px at `sm` and `md`, so this is also the size that fits
	 * the slot exactly instead of being scaled into it.
	 */
	const ICON = 'sm' as const;

	/**
	 * Width of the inspector's label column, in pixels.
	 *
	 * Wide enough for the longest label the panel uses at the label type size,
	 * which is what puts every control on a single left edge.
	 */
	const LABEL_COLUMN = 80;

	/**
	 * Room the tab strip leaves for the rest of the header, in pixels.
	 *
	 * Covers the menu button ahead of the strip, the save note and Export button
	 * after it, and the bar's own gutters. Generous rather than exact: too small
	 * and the strip crowds Export, too large and it gives up room it could have
	 * spent on tabs.
	 */
	const TAB_STRIP_RESERVE = 320;

	const PHOTO_LAYER_SRC =
		'https://lookaside.facebook.com/assets/astryx/moody-scene-vertical-1.png';

	type LayerKind = 'text' | 'image';

	/** What the Appearance submenu sets on the editor chrome. */
	type Appearance = ThemeMode;

	/** Horizontal and vertical placement of a text layer inside its box. */
	type AlignX = 'start' | 'center' | 'end' | 'justify';
	type AlignY = 'start' | 'center' | 'end';
	type Decoration = 'none' | 'underline' | 'line-through';
	type Transform = 'none' | 'capitalize' | 'uppercase' | 'lowercase';

	/**
	 * The nine CSS filters the image inspector exposes, in the order they are
	 * listed there. Kept as one record so a layer carries a single `filters`
	 * object and the artboard can build a `filter` string by walking it, rather
	 * than nine optional fields that every read has to spell out.
	 */
	interface Filters {
		blur: number;
		brightness: number;
		contrast: number;
		grayscale: number;
		hue: number;
		invert: number;
		opacity: number;
		saturate: number;
		sepia: number;
	}

	/** A drop shadow, in the four numbers the shadow popover edits. */
	interface Shadow {
		x: number;
		y: number;
		blur: number;
		spread: number;
		color: string;
	}

	interface Layer {
		id: string;
		name: string;
		kind: LayerKind;
		x: number;
		y: number;
		width: number;
		height: number;
		rotation: number;
		/**
		 * Padding is two numbers, not one: a poster's inset is almost never
		 * square, and a single field makes the common case — wide margins, tight
		 * leading above and below — impossible to express without opening a
		 * per-side editor. Inline is the left/right pair, block the top/bottom,
		 * matching the axis names CSS uses for the same thing.
		 */
		paddingInline: number;
		paddingBlock: number;
		radius: number;
		isLocked: boolean;
		/** Copy for a text layer; the alt text for an image layer. */
		content: string;
		/** Undefined means the slot is empty and the field shows its placeholder. */
		border?: string;
		fill?: string;
		/** The shadow cast by the layer's box. */
		shadow?: Shadow;
		/** Type settings. Only text layers carry them, and only they show them. */
		family?: string;
		weight?: string;
		color?: string;
		size?: number;
		line?: number;
		tracking?: number;
		alignX?: AlignX;
		alignY?: AlignY;
		isItalic?: boolean;
		decoration?: Decoration;
		transform?: Transform;
		/**
		 * The shadow cast by the glyphs, which is a different property from the
		 * one in Styles: that one is the box's, this one is the type's, and a
		 * layer can carry both.
		 */
		textShadow?: Shadow;
		stroke?: number;
		/** Image settings. Only image layers carry them. */
		fit?: string;
		filters?: Filters;
	}

	const NO_SHADOW: Shadow = { x: 0, y: 0, blur: 0, spread: 0, color: '#000000' };

	const NO_FILTERS: Filters = {
		blur: 0,
		brightness: 100,
		contrast: 100,
		grayscale: 0,
		hue: 0,
		invert: 0,
		opacity: 100,
		saturate: 100,
		sepia: 0
	};

	/** An open document in the strip above the menubar. */
	interface DocumentTabData {
		id: string;
		name: string;
		icon: typeof FileIcon;
	}

	// Every tab carries the same mark: varying it per document would imply a
	// distinction the editor does not make, and a strip of mixed glyphs is harder
	// to scan than a strip of one. A tab stands for an open file, so the file mark
	// is the literal one; the frame mark belongs to the layer groups, where it
	// names an actual container.
	const INITIAL_TABS: DocumentTabData[] = [
		{ id: 'poster', name: 'Salzburg poster', icon: FileIcon },
		{ id: 'brand', name: 'Brand sheet', icon: FileIcon },
		{ id: 'draft', name: 'Untitled draft', icon: FileIcon }
	];

	const INITIAL_LAYERS: Layer[] = [
		{
			id: 'headline',
			name: 'Headline',
			kind: 'text',
			x: 56,
			y: 136,
			width: 968,
			height: 300,
			rotation: 0,
			paddingInline: 0,
			paddingBlock: 0,
			radius: 0,
			isLocked: false,
			content: 'A weekend in Salzburg',
			fill: '#111111',
			family: 'Anton',
			weight: 'Regular',
			color: '#111111',
			size: 112,
			line: 100,
			tracking: -2,
			alignX: 'start',
			alignY: 'start',
			isItalic: false,
			decoration: 'none',
			transform: 'uppercase',
			stroke: 0
		},
		{
			id: 'dateline',
			name: 'Dateline',
			kind: 'text',
			x: 56,
			y: 56,
			width: 968,
			height: 56,
			rotation: 0,
			paddingInline: 0,
			paddingBlock: 0,
			radius: 0,
			isLocked: false,
			content: 'March 14–16 · Austria',
			family: 'Inter Tight',
			weight: 'Medium',
			color: '#111111',
			size: 26,
			line: 120,
			tracking: 32,
			alignX: 'center',
			alignY: 'start',
			isItalic: false,
			decoration: 'none',
			transform: 'uppercase',
			stroke: 0
		},
		{
			id: 'photo',
			name: 'Photo',
			kind: 'image',
			x: 0,
			y: 0,
			width: 1080,
			height: 1920,
			rotation: 0,
			paddingInline: 0,
			paddingBlock: 0,
			radius: 0,
			isLocked: true,
			content: 'The Salzach river and old town rooftops at dusk',
			fit: 'Cover',
			filters: NO_FILTERS
		}
	];

	/** The inspector's vertical alignment, in the words a Stack uses for it. */
	const V_ALIGN = { start: 'start', center: 'center', end: 'end' } as const;

	/**
	 * Each preset carries its own icon. A library where every row shows the same
	 * glyph is a list you have to read word by word; distinct marks let the eye
	 * find the row it wants.
	 */
	const EFFECT_PRESETS = [
		{ label: 'Grain overlay', icon: Aperture },
		{ label: 'Halftone', icon: Grip },
		{ label: 'Duotone teal', icon: Contrast }
	];

	/**
	 * The icon-only segmented rows in the text inspector. Each entry keeps its
	 * spoken label next to its glyph, because `isLabelHidden` hides the text but
	 * still needs it for the accessible name.
	 */
	const ALIGN_X: { value: AlignX; label: string; icon: typeof TextAlignStart }[] = [
		{ value: 'start', label: 'Align left', icon: TextAlignStart },
		{ value: 'center', label: 'Align centre', icon: TextAlignCenter },
		{ value: 'end', label: 'Align right', icon: TextAlignEnd },
		{ value: 'justify', label: 'Justify', icon: TextAlignJustify }
	];

	const ALIGN_Y: { value: AlignY; label: string; icon: typeof ArrowUpToLine }[] = [
		{ value: 'start', label: 'Align top', icon: ArrowUpToLine },
		{ value: 'center', label: 'Align middle', icon: FoldVertical },
		{ value: 'end', label: 'Align bottom', icon: ArrowDownToLine }
	];

	const DECORATIONS: { value: Decoration; label: string; icon: typeof CaseSensitive }[] = [
		{ value: 'none', label: 'No decoration', icon: CaseSensitive },
		{ value: 'underline', label: 'Underline', icon: Underline },
		{ value: 'line-through', label: 'Strikethrough', icon: Strikethrough }
	];

	const TRANSFORMS: { value: Transform; label: string; icon: typeof Minus }[] = [
		{ value: 'none', label: 'As typed', icon: Minus },
		{ value: 'capitalize', label: 'Capitalise', icon: CaseSensitive },
		{ value: 'uppercase', label: 'Uppercase', icon: CaseUpper },
		{ value: 'lowercase', label: 'Lowercase', icon: CaseLower }
	];

	/**
	 * The nine image filters, with the range and unit each one is stated in.
	 * `max` is what the slider runs to rather than what CSS allows — brightness
	 * and saturate go past 200%, but a rail that reaches 500 spends most of its
	 * travel somewhere nobody drags to.
	 */
	const FILTERS: {
		key: keyof Filters;
		label: string;
		max: number;
		unit: string;
	}[] = [
		{ key: 'blur', label: 'Blur', max: 20, unit: 'px' },
		{ key: 'brightness', label: 'Brightness', max: 200, unit: '%' },
		{ key: 'contrast', label: 'Contrast', max: 200, unit: '%' },
		{ key: 'grayscale', label: 'Grayscale', max: 100, unit: '%' },
		{ key: 'hue', label: 'Hue', max: 360, unit: 'deg' },
		{ key: 'invert', label: 'Invert', max: 100, unit: '%' },
		{ key: 'opacity', label: 'Opacity', max: 100, unit: '%' },
		{ key: 'saturate', label: 'Saturate', max: 200, unit: '%' },
		{ key: 'sepia', label: 'Sepia', max: 100, unit: '%' }
	];

	const ZOOM_OPTIONS = [
		{ value: '0.25', label: '25%' },
		{ value: '0.4', label: '40%' },
		{ value: '0.6', label: '60%' },
		{ value: '1', label: '100%' }
	];

	const FONT_OPTIONS = ['Anton', 'Archivo Black', 'Bebas Neue', 'Inter Tight'];
	const WEIGHT_OPTIONS = ['Regular', 'Medium', 'Semibold', 'Bold'];

	/** What the Insert submenu can add to the artboard. */
	const INSERT_ITEMS: { label: string; icon: typeof Frame }[] = [
		{ label: 'Frame', icon: Frame },
		{ label: 'Group', icon: Group },
		{ label: 'Text', icon: Type },
		{ label: 'Image', icon: ImageIcon }
	];

	/** Written once: the Export button and the File menu offer the same three. */
	const EXPORT_FORMATS = ['PNG · 1080 × 1920', 'JPG · 1080 × 1920', 'PDF · print ready'];

	const EXPORT_MENU = EXPORT_FORMATS.map((label) => ({ label }));

	// =============================================================================
	// Colour
	// =============================================================================

	/** A colour as the picker holds it: hue 0–360, saturation and value 0–100. */
	interface Hsv {
		h: number;
		s: number;
		v: number;
	}

	/**
	 * The picker thinks in HSV because that is the shape of its two controls — a
	 * hue rail and a saturation/value plane — while every value it reads and
	 * writes is a hex string. These convert between the two.
	 */
	function hsvToHex({ h, s, v }: Hsv): string {
		const channel = (n: number) => {
			const k = (n + h / 60) % 6;
			const value = (v / 100) * (1 - (s / 100) * Math.max(0, Math.min(k, 4 - k, 1)));
			return Math.round(value * 255)
				.toString(16)
				.padStart(2, '0');
		};
		return `#${channel(5)}${channel(3)}${channel(1)}`;
	}

	function hexToHsv(hex: string): Hsv {
		const parsed = /^#?([\da-f]{6})$/i.exec(hex.trim());
		if (!parsed) {
			return { h: 0, s: 0, v: 0 };
		}
		const int = parseInt(parsed[1], 16);
		const r = ((int >> 16) & 255) / 255;
		const g = ((int >> 8) & 255) / 255;
		const b = (int & 255) / 255;
		const max = Math.max(r, g, b);
		const span = max - Math.min(r, g, b);
		let h = 0;
		if (span !== 0) {
			if (max === r) {
				h = ((g - b) / span) % 6;
			} else if (max === g) {
				h = (b - r) / span + 2;
			} else {
				h = (r - g) / span + 4;
			}
		}
		return {
			h: (Math.round(h * 60) + 360) % 360,
			s: max === 0 ? 0 : Math.round((span / max) * 100),
			v: Math.round(max * 100)
		};
	}

	/**
	 * Builds the `filter` shorthand from the nine values the inspector edits.
	 *
	 * Only the ones that are off their neutral point are emitted: a filter list
	 * of nine no-op functions still forces the image onto its own composited
	 * layer, and a poster that is only ever blurred should not pay for the other
	 * eight.
	 */
	function filterCss(filters: Filters): string {
		const parts = [
			['blur', filters.blur, 0, 'px'],
			['brightness', filters.brightness, 100, '%'],
			['contrast', filters.contrast, 100, '%'],
			['grayscale', filters.grayscale, 0, '%'],
			['hue-rotate', filters.hue, 0, 'deg'],
			['invert', filters.invert, 0, '%'],
			['opacity', filters.opacity, 100, '%'],
			['saturate', filters.saturate, 100, '%'],
			['sepia', filters.sepia, 0, '%']
		] as const;
		const active = parts
			.filter(([, value, neutral]) => value !== neutral)
			.map(([name, value, , unit]) => `${name}(${value}${unit})`);
		return active.length > 0 ? active.join(' ') : 'none';
	}

	/** `text-shadow` takes no spread, so a text layer's shadow drops it. */
	function shadowCss(shadow: Shadow | undefined): string {
		return shadow ? `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color}` : 'none';
	}

	// =============================================================================
	// Dynamic style helpers
	// =============================================================================

	// Zoom the way a design tool does: lay the artboard out once at its native
	// size and scale the painted result. Type and spacing stay in artboard
	// pixels, and the poster gets no reflow between zoom steps.
	const artboardStyle = (scale: number) =>
		`width: ${FRAME.width}px; transform: scale(${scale}); transform-origin: top left;`;

	// Type the inspector owns. Size and tracking can't be theme tokens: they
	// belong to a layer, not to the poster, and they change per keystroke.
	// Tracking is a percentage of the type size, the way a design tool states
	// it, so it holds when the size changes.
	const typeStyle = (
		size: number,
		tracking: number,
		line: number,
		color: string,
		stroke: number,
		shadow: string
	) =>
		[
			`font-size: ${size}px`,
			`letter-spacing: ${tracking / 100}em`,
			`line-height: ${line}%`,
			`color: ${color}`,
			stroke > 0 ? `-webkit-text-stroke-width: ${stroke}px` : '',
			stroke > 0 ? `-webkit-text-stroke-color: ${color}` : '',
			`text-shadow: ${shadow}`
		]
			.filter(Boolean)
			.join('; ');

	/**
	 * The enumerable half of a text layer's styling. These are closed sets, so
	 * they are inline declarations picked by value rather than classes.
	 */
	const textDecorations = (layer: Layer) =>
		[
			`text-align: ${layer.alignX ?? 'start'}`,
			`text-transform: ${layer.transform ?? 'none'}`,
			`text-decoration-line: ${layer.decoration ?? 'none'}`,
			`font-style: ${layer.isItalic ? 'italic' : 'normal'}`
		].join('; ');

	// =============================================================================
	// Page state
	// =============================================================================

	let layers = $state<Layer[]>(INITIAL_LAYERS);
	let selectedID = $state('headline');
	let panel = $state('layers');
	let zoom = $state('0.4');

	// The picker is presentational here: a template has no upload endpoint to
	// post to, and swapping the artboard for a local object URL would leave the
	// page showing something the template does not ship. Naming the chosen file
	// is the honest middle — the control demonstrably works, and nothing
	// pretends to have been uploaded.
	let imageName = $state('Image');
	// What the View submenu toggles. A design tool trades chrome for canvas, so
	// these drive the real Layout slots rather than standing in for them.
	let chrome = $state({
		left: true,
		right: true,
		toolbar: true
	});
	let appearance = $state<Appearance>('system');
	let tabs = $state<DocumentTabData[]>(INITIAL_TABS);
	let activeTab = $state(INITIAL_TABS[0].id);
	// Only used to name new tabs, so it counts documents opened rather than
	// documents open — reusing "Untitled 2" after closing one would be worse.
	let untitledCount = 1;

	interface PickerState {
		hsv: Hsv;
		draft: string;
	}

	let pickers = $state<Record<string, PickerState>>({});

	const fileInputID = $props.id();

	// Closing the open document has to hand the strip a new one, and the
	// neighbour is the least surprising choice: the tab that slides under the
	// pointer is the one that takes over. Closing the last tab leaves the strip
	// empty rather than inventing a document nobody asked for.
	const closeTab = (id: string) => {
		const index = tabs.findIndex((tab) => tab.id === id);
		const next = tabs.filter((tab) => tab.id !== id);
		if (id === activeTab) {
			const neighbour = next[index] ?? next[index - 1];
			activeTab = neighbour ? neighbour.id : '';
		}
		tabs = next;
	};

	const addTab = () => {
		untitledCount += 1;
		const tab: DocumentTabData = {
			id: `untitled-${untitledCount}`,
			name: `Untitled ${untitledCount}`,
			icon: FileIcon
		};
		tabs = [...tabs, tab];
		activeTab = tab.id;
	};

	// Both rails are drag-sized. The floors are the width each panel stops being
	// useful below — the rail at the point layer names start truncating, the
	// inspector at the point its two-field rows stop fitting side by side — and
	// the ceilings keep either from eating the canvas they exist to serve.
	const rail = useResizable(() => ({ defaultSize: 216, minSizePx: 176, maxSizePx: 320 }));
	const inspector = useResizable(() => ({ defaultSize: 288, minSizePx: 264, maxSizePx: 400 }));

	const selected = $derived(layers.find((layer) => layer.id === selectedID) ?? layers[0]);
	const scale = $derived(Number(zoom));

	const updateSelected = (patch: Partial<Layer>) => {
		layers = layers.map((layer) =>
			layer.id === selectedID ? { ...layer, ...patch } : layer
		);
	};

	const toggleLock = (id: string) => {
		layers = layers.map((layer) =>
			layer.id === id ? { ...layer, isLocked: !layer.isLocked } : layer
		);
	};

	const headline = $derived(layers.filter((layer) => layer.kind === 'text')[0]);
	const dateline = $derived(layers.filter((layer) => layer.kind === 'text')[1]);
	const photo = $derived(layers.filter((layer) => layer.kind === 'image')[0]);

	// --- Colour picker commit helpers -----------------------------------------

	const pickerFor = (key: string, value: string): PickerState =>
		pickers[key] ?? { hsv: hexToHsv(value), draft: value };

	const commitColor = (key: string, next: Hsv, onChange: (value: string) => void) => {
		const hex = hsvToHex(next);
		pickers = { ...pickers, [key]: { hsv: next, draft: hex } };
		onChange(hex);
	};

	const changeDraft = (
		key: string,
		next: string,
		value: string,
		onChange: (value: string) => void
	) => {
		const current = pickerFor(key, value);
		if (/^#?[\da-f]{6}$/i.test(next.trim())) {
			pickers = { ...pickers, [key]: { hsv: hexToHsv(next), draft: next } };
			onChange(next.startsWith('#') ? next : `#${next}`);
		} else {
			pickers = { ...pickers, [key]: { hsv: current.hsv, draft: next } };
		}
	};

	/**
	 * Drag tracking for the saturation/value plane, which is the one control here
	 * that has to be painted: it is two axes at once, and no slider is.
	 *
	 * Pointer capture is what makes the drag survive leaving the element: a fast
	 * diagonal out of the plane keeps tracking instead of stopping dead at the
	 * edge, which is the difference between a picker that feels attached to the
	 * cursor and one that keeps dropping it.
	 */
	const planeTrack = (
		event: PointerEvent,
		key: string,
		value: string,
		onChange: (v: string) => void
	) => {
		const element = event.currentTarget as HTMLElement;
		const box = element.getBoundingClientRect();
		const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
		const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
		const hsv = pickerFor(key, value).hsv;
		commitColor(
			key,
			{ ...hsv, s: Math.round(x * 100), v: Math.round(100 - y * 100) },
			onChange
		);
	};

	const onPlanePointerDown = (
		event: PointerEvent,
		key: string,
		value: string,
		onChange: (v: string) => void
	) => {
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		planeTrack(event, key, value, onChange);
	};

	const onPlanePointerMove = (
		event: PointerEvent,
		key: string,
		value: string,
		onChange: (v: string) => void
	) => {
		if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
			planeTrack(event, key, value, onChange);
		}
	};

	/** Arrow keys on the plane: left/right saturate, up/down brighten. */
	const onPlaneKeyDown = (
		event: KeyboardEvent,
		key: string,
		value: string,
		onChange: (v: string) => void
	) => {
		const sign =
			event.key === 'ArrowRight' || event.key === 'ArrowUp'
				? 1
				: event.key === 'ArrowLeft' || event.key === 'ArrowDown'
					? -1
					: 0;
		if (sign === 0) {
			return;
		}
		event.preventDefault();
		const horizontal = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
		const clamp = (n: number) => Math.min(100, Math.max(0, n));
		const hsv = pickerFor(key, value).hsv;
		commitColor(
			key,
			{
				h: hsv.h,
				s: clamp(hsv.s + (horizontal ? sign * 2 : 0)),
				v: clamp(hsv.v + (horizontal ? 0 : sign * 2))
			},
			onChange
		);
	};
</script>

<!-- =============================================================================
     Shared snippets
     ============================================================================= -->

{#snippet shortcut(text: string)}
	<Text type="supporting" color="secondary">{text}</Text>
{/snippet}

{#snippet sCmdN()}{@render shortcut('⌘N')}{/snippet}
{#snippet sCmdO()}{@render shortcut('⌘O')}{/snippet}
{#snippet sCmdS()}{@render shortcut('⌘S')}{/snippet}
{#snippet sShiftCmdS()}{@render shortcut('⇧⌘S')}{/snippet}
{#snippet sCmdW()}{@render shortcut('⌘W')}{/snippet}
{#snippet sCmdZ()}{@render shortcut('⌘Z')}{/snippet}
{#snippet sShiftCmdZ()}{@render shortcut('⇧⌘Z')}{/snippet}
{#snippet sCmdX()}{@render shortcut('⌘X')}{/snippet}
{#snippet sCmdC()}{@render shortcut('⌘C')}{/snippet}
{#snippet sCmdV()}{@render shortcut('⌘V')}{/snippet}
{#snippet sCmdD()}{@render shortcut('⌘D')}{/snippet}
{#snippet sBackspace()}{@render shortcut('⌫')}{/snippet}
{#snippet sCmdB()}{@render shortcut('⌘B')}{/snippet}
{#snippet sShiftCmdB()}{@render shortcut('⇧⌘B')}{/snippet}
{#snippet sCmdPeriod()}{@render shortcut('⌘.')}{/snippet}
{#snippet sCmdCloseBracket()}{@render shortcut('⌘]')}{/snippet}
{#snippet sCmdOpenBracket()}{@render shortcut('⌘[')}{/snippet}
{#snippet sShiftCmdL()}{@render shortcut('⇧⌘L')}{/snippet}
{#snippet sCmdSlash()}{@render shortcut('⌘/')}{/snippet}

{#snippet menuIcon()}
	<Icon icon={Menu} size={ICON} />
{/snippet}
{#snippet downloadIcon()}
	<Icon icon={Download} size={ICON} />
{/snippet}
{#snippet plusIcon()}
	<Icon icon={Plus} size={ICON} color="secondary" />
{/snippet}
{#snippet undoIcon()}
	<Icon icon={Undo2} size={ICON} />
{/snippet}
{#snippet redoIcon()}
	<Icon icon={Redo2} size={ICON} />
{/snippet}
{#snippet frameIcon()}
	<Icon icon={Frame} size={ICON} color="secondary" />
{/snippet}
{#snippet addFrameIcon()}
	<Icon icon={Frame} size={ICON} />
{/snippet}
{#snippet addTextIcon()}
	<Icon icon={Type} size={ICON} />
{/snippet}
{#snippet addImageIcon()}
	<Icon icon={ImageIcon} size={ICON} />
{/snippet}
{#snippet lockIcon()}
	<Icon icon={Lock} size={ICON} />
{/snippet}
{#snippet unlockIcon()}
	<Icon icon={LockOpen} size={ICON} />
{/snippet}
{#snippet panelLeftIcon()}
	<Icon icon={PanelLeft} size={ICON} />
{/snippet}
{#snippet panelRightIcon()}
	<Icon icon={PanelRight} size={ICON} />
{/snippet}
{#snippet panelBottomIcon()}
	<Icon icon={PanelBottom} size={ICON} />
{/snippet}
{#snippet closeIcon()}
	<Icon icon={X} size={ICON} />
{/snippet}

{#snippet glyphText(char: string)}
	<!--
		Draws a letterform sized to the icon grid.

		A design tool names a numeric field from inside it — the X sits in the box
		with the number, not in a segment bolted to its edge — so the row reads as
		one control. The glyphs inherit `currentColor` and the slot's sizing, so a
		letter and an icon are interchangeable in the same position.
	-->
	<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
		<text
			x="12"
			y="12"
			fill="currentColor"
			font-size={char.length > 1 ? 13 : 17}
			font-weight="500"
			text-anchor="middle"
			dominant-baseline="central">{char}</text
		>
	</svg>
{/snippet}

{#snippet glyphX()}{@render glyphText('X')}{/snippet}
{#snippet glyphY()}{@render glyphText('Y')}{/snippet}
{#snippet glyphW()}{@render glyphText('W')}{/snippet}
{#snippet glyphH()}{@render glyphText('H')}{/snippet}

{#snippet paddingInlineIcon()}
	<Icon icon={PanelLeftRightDashed} size={ICON} />
{/snippet}
{#snippet paddingBlockIcon()}
	<Icon icon={PanelTopBottomDashed} size={ICON} />
{/snippet}
{#snippet radiusIcon()}
	<Icon icon={Scan} size={ICON} />
{/snippet}
{#snippet angleIcon()}
	<Icon icon={TriangleRight} size={ICON} />
{/snippet}
{#snippet rotateCcwIcon()}
	<Icon icon={RotateCcw} size={ICON} />
{/snippet}
{#snippet rotateCwIcon()}
	<Icon icon={RotateCw} size={ICON} />
{/snippet}
{#snippet flipHIcon()}
	<Icon icon={FlipHorizontal2} size={ICON} />
{/snippet}
{#snippet flipVIcon()}
	<Icon icon={FlipVertical2} size={ICON} />
{/snippet}
{#snippet squareSquareIcon()}
	<Icon icon={SquareSquare} size={ICON} />
{/snippet}
{#snippet squareRoundCornerIcon()}
	<Icon icon={SquareRoundCorner} size={ICON} />
{/snippet}

<!-- =============================================================================
     Panel building blocks
     ============================================================================= -->

{#snippet axisField(
	icon: Snippet,
	label: string,
	value: number,
	onChange: (next: number) => void
)}
	<StackItem size="fill">
		<NumberInput
			{label}
			isLabelHidden
			startIcon={icon}
			size="sm"
			{value}
			onChange={(next: number | null) => onChange(next ?? 0)}
			isWheelEnabled={false}
		/>
	</StackItem>
{/snippet}

{#snippet stepperField(label: string, value: number, onChange: (next: number) => void)}
	<StackItem size="fill">
		<NumberInput
			{label}
			isLabelHidden
			size="sm"
			hasNumberSteppers
			{value}
			onChange={(next: number | null) => onChange(next ?? 0)}
			isWheelEnabled={false}
		/>
	</StackItem>
{/snippet}

{#snippet colorPlane(key: string, value: string, onChange: (value: string) => void)}
	{@const state = pickerFor(key, value)}
	<div class="ce-plane-stack">
		<div
			role="slider"
			tabindex="0"
			aria-label="Saturation and brightness"
			aria-valuetext={`${state.hsv.s}% saturation, ${state.hsv.v}% brightness`}
			aria-valuenow={state.hsv.s}
			aria-valuemin="0"
			aria-valuemax="100"
			class="ce-plane"
			style={`background-color: hsl(${state.hsv.h} 100% 50%)`}
			onkeydown={(event) => onPlaneKeyDown(event, key, value, onChange)}
			onpointerdown={(event) => onPlanePointerDown(event, key, value, onChange)}
			onpointermove={(event) => onPlanePointerMove(event, key, value, onChange)}
		>
			<span
				class="ce-plane-thumb"
				style={`inset-inline-start: ${state.hsv.s}%; inset-block-start: ${100 - state.hsv.v}%; background-color: ${hsvToHex(state.hsv)}`}
			></span>
		</div>
		<!--
			The hue rail is a real Slider with its track repainted, not a
			hand-rolled one: the rainbow is the only thing about it that is not
			already a Slider, and `slider-track` is a theming target. The
			template's one custom theme is mounted narrowly here so the nine filter
			sliders in the same panel keep the plain track they should have.
		-->
		<Theme theme={canvasEditorTheme}>
			<Slider
				label="Hue"
				isLabelHidden
				min={0}
				max={360}
				value={state.hsv.h}
				onChange={(h: number) => commitColor(key, { ...state.hsv, h }, onChange)}
				valueDisplay="none"
			/>
		</Theme>
		<TextInput
			label="Hex"
			isLabelHidden
			size="sm"
			value={state.draft}
			onChange={(next: string) => changeDraft(key, next, value, onChange)}
		/>
	</div>
{/snippet}

{#snippet swatch(
	key: string,
	label: string,
	value: string | undefined,
	onChange: (next: string) => void,
	extra?: Snippet
)}
	{#snippet pickerContent()}
		<VStack gap={3}>
			<Text type="label" weight="semibold">{label}</Text>
			{@render colorPlane(key, value ?? '#ffffff', onChange)}
			{#if extra}{@render extra()}{/if}
		</VStack>
	{/snippet}
	<Popover {label} placement="start" alignment="start" width={248} content={pickerContent}>
		<button
			type="button"
			aria-label={`${label}${value ? `, ${value}` : ', not set'}`}
			class="ce-swatch{value != null ? ' ce-swatch-filled' : ''}"
			style={value != null ? `background-color: ${value}` : undefined}
		></button>
	</Popover>
{/snippet}

{#snippet styleRow(
	label: string,
	name: string,
	value: string | undefined,
	placeholder: string,
	onChange: (next: string) => void,
	onClear: () => void,
	extra?: Snippet
)}
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>{label}</Text>
		</HStack>
		<StackItem size="fill">
			<TextInput
				label={name}
				isLabelHidden
				size="sm"
				value={value ?? ''}
				{placeholder}
				onChange={onChange}
			/>
		</StackItem>
		{@render swatch(name, name, value, onChange, extra)}
		<IconButton
			label={`Clear ${name.toLowerCase()}`}
			tooltip="Clear"
			size="sm"
			variant="ghost"
			isDisabled={value === undefined}
			onclick={onClear}
			icon={clearIcon}
		/>
	</HStack>
{/snippet}

{#snippet clearIcon()}
	<Icon icon={X} size={ICON} />
{/snippet}

{#snippet shadowFields(
	name: string,
	shadow: Shadow,
	onChange: (next: Shadow) => void
)}
	<VStack gap={2}>
		{#each ['x', 'y', 'blur', 'spread'] as key (key)}
			{@const fieldLabel = key === 'x' ? 'X' : key === 'y' ? 'Y' : key === 'blur' ? 'Blur' : 'Spread'}
			<HStack gap={2} vAlign="center">
				<HStack width={56} class="ce-label-column">
					<Text type="label" color="secondary" maxLines={1}>{fieldLabel}</Text>
				</HStack>
				<StackItem size="fill">
					<NumberInput
						label={`${name} ${fieldLabel.toLowerCase()}`}
						isLabelHidden
						size="sm"
						hasNumberSteppers
						value={shadow[key as 'x' | 'y' | 'blur' | 'spread']}
						onChange={(next: number | null) => onChange({ ...shadow, [key]: next ?? 0 })}
						isWheelEnabled={false}
					/>
				</StackItem>
			</HStack>
		{/each}
	</VStack>
{/snippet}

{#snippet inspectorSection(title: string, children: Snippet)}
	<!--
		The panel itself stays at zero padding and each section carries the gutter
		instead. That is what keeps the rules between sections running edge to
		edge: pad the panel and every divider insets by the gutter, turning a
		full-bleed rule into a floating line.
	-->
	<Section padding={3} dividers={['bottom']}>
		<VStack gap={3}>
			<Text type="label" weight="semibold">{title}</Text>
			{@render children()}
		</VStack>
	</Section>
{/snippet}

<!-- =============================================================================
     Inspector sections
     ============================================================================= -->

{#snippet inspectorLayout()}
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Padding</Text>
		</HStack>
		<StackItem size="fill">
			<HStack gap={1} vAlign="center">
				{@render axisField(
					paddingInlineIcon,
					'Horizontal padding',
					selected.paddingInline,
					(next) => updateSelected({ paddingInline: next })
				)}
				{@render axisField(
					paddingBlockIcon,
					'Vertical padding',
					selected.paddingBlock,
					(next) => updateSelected({ paddingBlock: next })
				)}
				<IconButton
					label="Set padding per side"
					tooltip="Per side"
					size="sm"
					variant="ghost"
					icon={squareSquareIcon}
				/>
			</HStack>
		</StackItem>
	</HStack>
{/snippet}

{#snippet inspectorLayer()}
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Position</Text>
		</HStack>
		<StackItem size="fill">
			<HStack gap={1} vAlign="center">
				{@render axisField(glyphX, 'Horizontal position', selected.x, (next) =>
					updateSelected({ x: next })
				)}
				{@render axisField(glyphY, 'Vertical position', selected.y, (next) =>
					updateSelected({ y: next })
				)}
			</HStack>
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Size</Text>
		</HStack>
		<StackItem size="fill">
			<HStack gap={1} vAlign="center">
				{@render axisField(glyphW, 'Width', selected.width, (next) =>
					updateSelected({ width: next })
				)}
				{@render axisField(glyphH, 'Height', selected.height, (next) =>
					updateSelected({ height: next })
				)}
			</HStack>
		</StackItem>
	</HStack>
{/snippet}

{#snippet boxShadowExtra()}
	{@render shadowFields('Box shadow', selected.shadow ?? NO_SHADOW, (next) =>
		updateSelected({ shadow: next })
	)}
{/snippet}

{#snippet inspectorStyles()}
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Radius</Text>
		</HStack>
		<StackItem size="fill">
			<HStack gap={1} vAlign="center">
				{@render axisField(radiusIcon, 'Corner radius', selected.radius, (next) =>
					updateSelected({ radius: next })
				)}
				<IconButton
					label="Set radius per corner"
					tooltip="Per corner"
					size="sm"
					variant="ghost"
					icon={squareRoundCornerIcon}
				/>
			</HStack>
		</StackItem>
	</HStack>
	{@render styleRow(
		'Border',
		'Border',
		selected.border,
		'Add…',
		(next) => updateSelected({ border: next }),
		() => updateSelected({ border: undefined })
	)}
	{@render styleRow(
		'Shadow',
		'Box shadow',
		selected.shadow?.color,
		'Add…',
		(next) =>
			updateSelected({
				shadow: { ...(selected.shadow ?? NO_SHADOW), color: next }
			}),
		() => updateSelected({ shadow: undefined }),
		boxShadowExtra
	)}
	{@render styleRow(
		'Fill',
		'Fill',
		selected.fill,
		'Add…',
		(next) => updateSelected({ fill: next }),
		() => updateSelected({ fill: undefined })
	)}
{/snippet}

{#snippet inspectorTransforms()}
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Rotate</Text>
		</HStack>
		<StackItem size="fill">
			<HStack gap={1} vAlign="center">
				{@render axisField(angleIcon, 'Rotation', selected.rotation, (next) =>
					updateSelected({ rotation: next })
				)}
				<IconButton
					label="Rotate counterclockwise"
					tooltip="−90°"
					size="sm"
					variant="ghost"
					onclick={() => updateSelected({ rotation: (selected.rotation + 270) % 360 })}
					icon={rotateCcwIcon}
				/>
				<IconButton
					label="Rotate clockwise"
					tooltip="+90°"
					size="sm"
					variant="ghost"
					onclick={() => updateSelected({ rotation: (selected.rotation + 90) % 360 })}
					icon={rotateCwIcon}
				/>
			</HStack>
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Flip</Text>
		</HStack>
		<StackItem size="fill">
			<HStack gap={1} vAlign="center" hAlign="end">
				<IconButton
					label="Flip horizontally"
					tooltip="Flip horizontally"
					size="sm"
					variant="ghost"
					icon={flipHIcon}
				/>
				<IconButton
					label="Flip vertically"
					tooltip="Flip vertically"
					size="sm"
					variant="ghost"
					icon={flipVIcon}
				/>
			</HStack>
		</StackItem>
	</HStack>
{/snippet}

{#snippet textShadowExtra()}
	{@render shadowFields('Text shadow', selected.textShadow ?? NO_SHADOW, (next) =>
		updateSelected({ textShadow: next })
	)}
{/snippet}

{#snippet inspectorText()}
	{#snippet normalStyleIcon()}
		<Icon icon={Baseline} size={ICON} />
	{/snippet}
	{#snippet italicStyleIcon()}
		<Icon icon={Italic} size={ICON} />
	{/snippet}
	<TextArea
		label="Content"
		isLabelHidden
		size="sm"
		rows={2}
		value={selected.content}
		onChange={(next: string) => updateSelected({ content: next })}
	/>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Font</Text>
		</HStack>
		<StackItem size="fill">
			<Selector
				label="Font family"
				isLabelHidden
				size="sm"
				value={selected.family}
				onChange={(next: string) => updateSelected({ family: next })}
				options={FONT_OPTIONS}
			/>
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Weight</Text>
		</HStack>
		<StackItem size="fill">
			<Selector
				label="Font weight"
				isLabelHidden
				size="sm"
				value={selected.weight}
				onChange={(next: string) => updateSelected({ weight: next })}
				options={WEIGHT_OPTIONS}
			/>
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Color</Text>
		</HStack>
		<StackItem size="fill">
			<TextInput
				label="Text colour"
				isLabelHidden
				size="sm"
				value={selected.color ?? ''}
				onChange={(next: string) => updateSelected({ color: next })}
			/>
		</StackItem>
		{@render swatch('Text colour', 'Text colour', selected.color, (next) =>
			updateSelected({ color: next })
		)}
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Size</Text>
		</HStack>
		<StackItem size="fill">
			{@render stepperField('Size', selected.size ?? 0, (next) =>
				updateSelected({ size: next })
			)}
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Line</Text>
		</HStack>
		<StackItem size="fill">
			{@render stepperField('Line', selected.line ?? 100, (next) =>
				updateSelected({ line: next })
			)}
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Spacing</Text>
		</HStack>
		<StackItem size="fill">
			{@render stepperField('Spacing', selected.tracking ?? 0, (next) =>
				updateSelected({ tracking: next })
			)}
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Align</Text>
		</HStack>
		<StackItem size="fill">
			<SegmentedControl
				label="Horizontal alignment"
				size="sm"
				layout="fill"
				value={selected.alignX ?? 'start'}
				onChange={(next: string) => updateSelected({ alignX: next as AlignX })}
			>
				{#each ALIGN_X as option (option.value)}
					{#snippet alignXIcon()}
						<Icon icon={option.icon} size={ICON} />
					{/snippet}
					<SegmentedControlItem
						value={option.value}
						label={option.label}
						isLabelHidden
						icon={alignXIcon}
					/>
				{/each}
			</SegmentedControl>
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Align</Text>
		</HStack>
		<StackItem size="fill">
			<SegmentedControl
				label="Vertical alignment"
				size="sm"
				layout="fill"
				value={selected.alignY ?? 'start'}
				onChange={(next: string) => updateSelected({ alignY: next as AlignY })}
			>
				{#each ALIGN_Y as option (option.value)}
					{#snippet alignYIcon()}
						<Icon icon={option.icon} size={ICON} />
					{/snippet}
					<SegmentedControlItem
						value={option.value}
						label={option.label}
						isLabelHidden
						icon={alignYIcon}
					/>
				{/each}
			</SegmentedControl>
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Style</Text>
		</HStack>
		<StackItem size="fill">
			<SegmentedControl
				label="Font style"
				size="sm"
				layout="fill"
				value={selected.isItalic ? 'italic' : 'normal'}
				onChange={(next: string) => updateSelected({ isItalic: next === 'italic' })}
			>
				<SegmentedControlItem
					value="normal"
					label="Regular"
					isLabelHidden
					icon={normalStyleIcon}
				/>
				<SegmentedControlItem
					value="italic"
					label="Italic"
					isLabelHidden
					icon={italicStyleIcon}
				/>
			</SegmentedControl>
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Decoration</Text>
		</HStack>
		<StackItem size="fill">
			<SegmentedControl
				label="Text decoration"
				size="sm"
				layout="fill"
				value={selected.decoration ?? 'none'}
				onChange={(next: string) => updateSelected({ decoration: next as Decoration })}
			>
				{#each DECORATIONS as option (option.value)}
					{#snippet decorationIcon()}
						<Icon icon={option.icon} size={ICON} />
					{/snippet}
					<SegmentedControlItem
						value={option.value}
						label={option.label}
						isLabelHidden
						icon={decorationIcon}
					/>
				{/each}
			</SegmentedControl>
		</StackItem>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Transform</Text>
		</HStack>
		<StackItem size="fill">
			<SegmentedControl
				label="Text transform"
				size="sm"
				layout="fill"
				value={selected.transform ?? 'none'}
				onChange={(next: string) => updateSelected({ transform: next as Transform })}
			>
				{#each TRANSFORMS as option (option.value)}
					{#snippet transformIcon()}
						<Icon icon={option.icon} size={ICON} />
					{/snippet}
					<SegmentedControlItem
						value={option.value}
						label={option.label}
						isLabelHidden
						icon={transformIcon}
					/>
				{/each}
			</SegmentedControl>
		</StackItem>
	</HStack>
	{@render styleRow(
		'Shadow',
		'Text shadow',
		selected.textShadow?.color,
		'Add…',
		(next) =>
			updateSelected({
				textShadow: { ...(selected.textShadow ?? NO_SHADOW), color: next }
			}),
		() => updateSelected({ textShadow: undefined }),
		textShadowExtra
	)}
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Stroke</Text>
		</HStack>
		<StackItem size="fill">
			<NumberInput
				label="Text stroke"
				isLabelHidden
				size="sm"
				value={selected.stroke ?? 0}
				onChange={(next: number | null) => updateSelected({ stroke: next ?? 0 })}
				isWheelEnabled={false}
			/>
		</StackItem>
		<IconButton
			label="Clear stroke"
			tooltip="Clear"
			size="sm"
			variant="ghost"
			isDisabled={!selected.stroke}
			onclick={() => updateSelected({ stroke: 0 })}
			icon={clearIcon}
		/>
	</HStack>
{/snippet}

{#snippet inspectorImage()}
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Edit</Text>
		</HStack>
		<StackItem size="fill">
			<TextInput
				label="Image source"
				isLabelHidden
				size="sm"
				value={imageName}
				isReadOnly
			/>
		</StackItem>
		<!--
			Astryx's FileInput is fixed at the medium element height, and this row
			is built on the 28px rhythm the rest of the inspector keeps, so the
			picker is driven from the thumbnail instead. The input stays in the
			DOM — hiding it with the attribute rather than unmounting it is what
			lets the button open it.
		-->
		<input
			id={fileInputID}
			type="file"
			accept="image/*"
			hidden
			onchange={(event) => {
				const file = (event.currentTarget as HTMLInputElement).files?.[0];
				if (file) {
					imageName = file.name;
				}
			}}
		/>
		<!--
			The trigger shows the picture rather than an icon standing in for one:
			the row is about which image this is. `onclick` is what gives Thumbnail
			its button semantics and hover overlay, and `label` doubles as the
			tooltip.
		-->
		<Thumbnail
			src={PHOTO_LAYER_SRC}
			alt={`Current image, ${imageName}`}
			label="Replace image"
			onclick={() => document.getElementById(fileInputID)?.click()}
			style="width: var(--spacing-7);"
		/>
	</HStack>
	<HStack gap={2} vAlign="center">
		<HStack width={LABEL_COLUMN} class="ce-label-column">
			<Text type="label" color="secondary" maxLines={1}>Fit</Text>
		</HStack>
		<StackItem size="fill">
			<Selector
				label="Image fit"
				isLabelHidden
				size="sm"
				value={selected.fit ?? 'Cover'}
				onChange={(next: string) => updateSelected({ fit: next })}
				options={['Cover', 'Contain', 'Fill']}
			/>
		</StackItem>
	</HStack>
{/snippet}

{#snippet inspectorFilters()}
	{#each FILTERS as filter (filter.key)}
		{@const value = (selected.filters ?? NO_FILTERS)[filter.key]}
		<HStack gap={2} vAlign="center">
			<HStack width={LABEL_COLUMN} class="ce-label-column">
				<Text type="label" color="secondary" maxLines={1}>{filter.label}</Text>
			</HStack>
			<StackItem size="fill">
				<Slider
					label={`${filter.label} slider`}
					isLabelHidden
					min={0}
					max={filter.max}
					{value}
					onChange={(next: number) =>
						updateSelected({
							filters: { ...(selected.filters ?? NO_FILTERS), [filter.key]: next }
						})}
					valueDisplay="none"
				/>
			</StackItem>
			<NumberInput
				label={filter.label}
				isLabelHidden
				size="sm"
				min={0}
				max={filter.max}
				{value}
				onChange={(next: number | null) =>
					updateSelected({
						filters: {
							... (selected.filters ?? NO_FILTERS),
							[filter.key]: next ?? 0
						}
					})}
				isWheelEnabled={false}
				width={64}
			/>
		</HStack>
	{/each}
{/snippet}

{#snippet inspectorPanel()}
	<LayoutPanel
		resizable={inspector.props}
		hasDivider
		padding={0}
		isScrollable
		label={`${selected.name} properties`}
		class="ce-folds-inspector"
	>
		{@render inspectorSection('Layout', inspectorLayout)}
		{@render inspectorSection('Layer', inspectorLayer)}
		{@render inspectorSection('Styles', inspectorStyles)}
		{@render inspectorSection('Transforms', inspectorTransforms)}
		{#if selected.kind === 'text'}
			{@render inspectorSection('Text', inspectorText)}
		{:else}
			{@render inspectorSection('Image', inspectorImage)}
			{@render inspectorSection('Filters', inspectorFilters)}
		{/if}
	</LayoutPanel>
{/snippet}

<!-- =============================================================================
     Page
     ============================================================================= -->

{#snippet header()}
	<LayoutHeader
		hasDivider
		padding={1}
		style="container-type: inline-size; container-name: editor-header;"
	>
		<HStack gap={0.5} vAlign="center" hAlign="between">
			<HStack gap={0.5} vAlign="center" class="ce-header-lead">
				<!--
					One button for every command in the editor, the way a
					single-window design tool does it. A menubar spends the top-left
					on five words that are only read when someone is already looking
					for a command; folding them into submenus hands that space to the
					tabs, which are read constantly. The commands keep their grouping
					— the bar became the first level of the menu rather than
					disappearing.
				-->
				<DropdownMenu
					button={{
						label: 'Menu',
						tooltip: 'Menu',
						variant: 'ghost',
						size: 'sm',
						isIconOnly: true,
						icon: menuIcon
					}}
					hasChevron={false}
					menuWidth={280}
				>
					<DropdownMenuSubMenu label="File">
						<DropdownMenuItem label="New poster" endContent={sCmdN} />
						<DropdownMenuItem label="Open…" endContent={sCmdO} />
						<DropdownMenuDivider />
						<DropdownMenuItem label="Save" endContent={sCmdS} />
						<DropdownMenuItem label="Save as…" endContent={sShiftCmdS} />
						<DropdownMenuSubMenu label="Export">
							{#each EXPORT_FORMATS as format (format)}
								<DropdownMenuItem label={format} />
							{/each}
						</DropdownMenuSubMenu>
						<DropdownMenuDivider />
						<DropdownMenuItem label="Close" endContent={sCmdW} />
					</DropdownMenuSubMenu>

					<DropdownMenuSubMenu label="Edit">
						<DropdownMenuItem label="Undo" endContent={sCmdZ} />
						<DropdownMenuItem label="Redo" endContent={sShiftCmdZ} />
						<DropdownMenuDivider />
						<DropdownMenuItem label="Cut" endContent={sCmdX} />
						<DropdownMenuItem label="Copy" endContent={sCmdC} />
						<DropdownMenuItem label="Paste" endContent={sCmdV} />
						<DropdownMenuDivider />
						<DropdownMenuItem label="Duplicate" endContent={sCmdD} />
						<!--
							Named, because a menu opened from the bar has lost sight of
							the rail: the row that would go is worth saying out loud
							before a destructive item is clicked.
						-->
						<DropdownMenuItem
							label={`Delete ${selected.name}`}
							variant="destructive"
							endContent={sBackspace}
						/>
					</DropdownMenuSubMenu>

					<!--
						Checkbox rows, not actions: each reports a state the user can
						see on the page, and the menu stays open so all three can be
						set in one visit.
					-->
					<DropdownMenuSubMenu label="View">
						<DropdownMenuCheckboxItem
							label="Left panel"
							icon={panelLeftIcon}
							endContent={sCmdB}
							value={chrome.left}
							onChange={(next) => (chrome = { ...chrome, left: next })}
						/>
						<DropdownMenuCheckboxItem
							label="Right panel"
							icon={panelRightIcon}
							endContent={sShiftCmdB}
							value={chrome.right}
							onChange={(next) => (chrome = { ...chrome, right: next })}
						/>
						<DropdownMenuCheckboxItem
							label="Canvas tools"
							icon={panelBottomIcon}
							endContent={sCmdPeriod}
							value={chrome.toolbar}
							onChange={(next) => (chrome = { ...chrome, toolbar: next })}
						/>
						<DropdownMenuDivider />
						<!--
							The same value the tool bar's zoom control holds, so setting
							it in either place moves the other.
						-->
						<DropdownMenuSubMenu label="Zoom">
							<DropdownMenuRadioGroup
								label="Zoom"
								value={zoom}
								onChange={(next: string) => (zoom = next)}
							>
								{#each ZOOM_OPTIONS as option (option.value)}
									<DropdownMenuRadioItem value={option.value} label={option.label} />
								{/each}
							</DropdownMenuRadioGroup>
						</DropdownMenuSubMenu>
						<DropdownMenuSubMenu label="Appearance">
							<DropdownMenuRadioGroup
								label="Appearance"
								value={appearance}
								onChange={(next: string) => (appearance = next as Appearance)}
							>
								<DropdownMenuRadioItem value="light" label="Light" />
								<DropdownMenuRadioItem value="dark" label="Dark" />
								<DropdownMenuRadioItem value="system" label="System" />
							</DropdownMenuRadioGroup>
						</DropdownMenuSubMenu>
					</DropdownMenuSubMenu>

					<DropdownMenuSubMenu label="Object">
						<DropdownMenuSubMenu label="Insert">
							{#each INSERT_ITEMS as item (item.label)}
								{#snippet insertIcon()}
									<Icon icon={item.icon} size={ICON} />
								{/snippet}
								<DropdownMenuItem label={item.label} icon={insertIcon} />
							{/each}
						</DropdownMenuSubMenu>
						<DropdownMenuDivider />
						<DropdownMenuItem label="Bring forward" endContent={sCmdCloseBracket} />
						<DropdownMenuItem label="Send backward" endContent={sCmdOpenBracket} />
						<DropdownMenuDivider />
						<!--
							The lock the rail row reveals on hover, reached from the
							menubar instead — one piece of state, two ways in.
						-->
						<DropdownMenuCheckboxItem
							label={`Lock ${selected.name}`}
							icon={selected.isLocked ? lockIcon : unlockIcon}
							endContent={sShiftCmdL}
							value={selected.isLocked}
							onChange={(next) => updateSelected({ isLocked: next })}
						/>
					</DropdownMenuSubMenu>

					<DropdownMenuDivider />

					<DropdownMenuSubMenu label="Help">
						<DropdownMenuItem label="Keyboard shortcuts" endContent={sCmdSlash} />
						<DropdownMenuItem label="Documentation" />
						<DropdownMenuDivider />
						<DropdownMenuItem label="About this editor" />
					</DropdownMenuSubMenu>
				</DropdownMenu>

				<!--
					A group, not a nav landmark: a landmark inside a role="toolbar"
					is not a place a screen reader expects one, and the toolbar
					already is the region. The group gives the strip a name, and each
					tab says whether it is the open document with aria-current.
				-->
				<HStack
					role="group"
					aria-label="Open documents"
					gap={0}
					vAlign="center"
					paddingInline={2}
					paddingBlock={1}
					isScrollable
					maxWidth={`calc(100cqw - ${TAB_STRIP_RESERVE}px)`}
					class="ce-tab-strip"
				>
					{#each tabs as tab, index (tab.id)}
						{@const isActiveTab = tab.id === activeTab}
						{@const previous = tabs[index - 1]}
						{#if previous != null}
							<!--
								Tabs are all one width, so the rule marks a boundary
								rather than sitting midway between two labels. It is
								dropped either side of the open document: that tab
								already reads as separate by its fill, and a rule
								running into the fill's rounded edge only crowds it.
								Hidden rather than unmounted, so moving the selection
								does not add or remove a flex item and slide the whole
								strip sideways under the pointer that just clicked it.
							-->
							<Divider
								orientation="vertical"
								class="ce-tab-rule{previous.id === activeTab || isActiveTab
									? ' ce-tab-rule-hidden'
									: ''}"
							/>
						{/if}
						{#snippet tabStart()}
							<Icon
								icon={tab.icon}
								size={ICON}
								color={isActiveTab ? 'primary' : 'secondary'}
							/>
						{/snippet}
						{#snippet tabEnd()}
							<IconButton
								label={`Close ${tab.name}`}
								icon={closeIcon}
								variant="ghost"
								size="sm"
								onclick={() => closeTab(tab.id)}
								class="ce-item-action ce-reveal{isActiveTab ? ' ce-reveal-shown' : ''}"
							/>
						{/snippet}
						<Item
							label={tab.name}
							density="compact"
							isSelected={isActiveTab}
							onclick={() => (activeTab = tab.id)}
							aria-current={isActiveTab ? 'true' : undefined}
							class="ce-tab{isActiveTab ? ' ce-tab-selected' : ''}"
							startContent={tabStart}
							endContent={tabEnd}
						/>
					{/each}
				</HStack>
				<!--
					Outside the strip on both counts: it is not one of the open
					documents the group is named for, and inside a strip that scrolls
					once the tabs stop fitting it would be the first thing to scroll
					out of reach — exactly when adding a document is most likely to
					be what you came for.
				-->
				<IconButton
					label="New document"
					tooltip="New document"
					variant="ghost"
					size="sm"
					onclick={addTab}
					icon={plusIcon}
				/>
			</HStack>
			<HStack gap={3} vAlign="center">
				<Text type="supporting" color="secondary">Saved · 2 min ago</Text>
				<DropdownMenu
					button={{
						label: 'Export',
						variant: 'ghost',
						size: 'sm',
						icon: downloadIcon
					}}
					alignment="end"
					items={EXPORT_MENU}
				/>
			</HStack>
		</HStack>
	</LayoutHeader>
{/snippet}

{#snippet artboard()}
	<HStack
		width="max-content"
		height="max-content"
		minHeight="100%"
		class="ce-canvas-stage"
	>
		<Card
			padding={0}
			elevation="med"
			width={FRAME.width * scale}
			height={FRAME.height * scale}
			class="ce-artboard-frame ce-artboard-centered"
		>
			<Theme theme={canvasEditorTheme} mode="light">
				<AspectRatio
					ratio={FRAME.width / FRAME.height}
					fit="cover"
					style={artboardStyle(scale)}
				>
					<img
						src={PHOTO_LAYER_SRC}
						alt={photo.content}
						style={`filter: ${filterCss(photo.filters ?? NO_FILTERS)}`}
					/>
					<!--
						Both text layers share one column, so vertical alignment is a
						property of the column and the headline speaks for it.
					-->
					<VStack
						padding={6}
						gap={3}
						vAlign={V_ALIGN[headline.alignY ?? 'start']}
						style="position: absolute; inset: 0;"
					>
						<Text
							type="supporting"
							display="block"
							style={`${typeStyle(
								dateline.size ?? 0,
								dateline.tracking ?? 0,
								dateline.line ?? 100,
								dateline.color ?? '#111111',
								dateline.stroke ?? 0,
								shadowCss(dateline.textShadow)
							)}; ${textDecorations(dateline)}`}
						>
							{dateline.content}
						</Text>
						<Heading
							level={2}
							type="display-1"
							textWrap="balance"
							style={`${typeStyle(
								headline.size ?? 0,
								headline.tracking ?? 0,
								headline.line ?? 100,
								headline.color ?? '#111111',
								headline.stroke ?? 0,
								shadowCss(headline.textShadow)
							)}; ${textDecorations(headline)}`}
						>
							{headline.content}
						</Heading>
					</VStack>
				</AspectRatio>
			</Theme>
		</Card>
	</HStack>
{/snippet}

{#snippet toolbarStart()}
	<IconButton
		label="Undo"
		tooltip="Undo"
		variant="ghost"
		icon={undoIcon}
		class="ce-tool-control"
	/>
	<IconButton
		label="Redo"
		tooltip="Redo"
		variant="ghost"
		icon={redoIcon}
		class="ce-tool-control"
	/>
	<Divider orientation="vertical" class="ce-tool-rule" />
	<IconButton
		label="Add frame"
		tooltip="Add frame"
		variant="ghost"
		icon={addFrameIcon}
		class="ce-tool-control"
	/>
	<IconButton
		label="Add text"
		tooltip="Add text"
		variant="ghost"
		icon={addTextIcon}
		class="ce-tool-control"
	/>
	<IconButton
		label="Add image"
		tooltip="Add image"
		variant="ghost"
		icon={addImageIcon}
		class="ce-tool-control"
	/>
	<Divider orientation="vertical" class="ce-tool-rule" />
	<Selector
		label="Zoom"
		isLabelHidden
		variant="ghost"
		value={zoom}
		onChange={(next: string) => (zoom = next)}
		options={ZOOM_OPTIONS}
		placement="above"
		width={92}
		class="ce-tool-control ce-tool-trailing"
	/>
{/snippet}

{#snippet canvasContent()}
	<!--
		`padding={4}` lifts the tool bar off the bottom edge: the footer reads this
		as its outer padding, so the bar floats over the backdrop rather than
		sitting on the sill.
	-->
	<LayoutContent padding={0}>
		<Section variant="muted" padding={0} height="100%">
			<Layout
				height="fill"
				padding={4}
				content={canvasStage}
				footer={chrome.toolbar ? canvasTools : undefined}
			/>
		</Section>
	</LayoutContent>
{/snippet}

{#snippet canvasStage()}
	<LayoutContent padding={6}>
		{@render artboard()}
	</LayoutContent>
{/snippet}

{#snippet canvasTools()}
	<LayoutFooter>
		<Center>
			<!--
				Padding of one step, and the controls inside round to the card's
				radius less that step — see `.ce-tool-control`.
			-->
			<Card padding={1} elevation="high">
				<Toolbar label="Canvas tools" size="sm" startContent={toolbarStart} />
			</Card>
		</Center>
	</LayoutFooter>
{/snippet}

{#snippet leftPanel()}
	<LayoutPanel
		resizable={rail.props}
		hasDivider
		padding={2}
		label="Layers and assets"
		class="ce-folds-rail"
	>
		<VStack gap={3}>
			<SegmentedControl
				label="Left panel"
				size="sm"
				layout="fill"
				value={panel}
				onChange={(next: string) => (panel = next)}
			>
				<SegmentedControlItem label="Layers" value="layers" />
				<SegmentedControlItem label="Library" value="library" />
			</SegmentedControl>
			{#if panel === 'layers'}
				{#snippet textStart()}
					<Icon icon={Type} size={ICON} color="secondary" />
				{/snippet}
				{#snippet imageStart()}
					<Icon icon={ImageIcon} size={ICON} color="secondary" />
				{/snippet}
				{#snippet headlineEnd()}
					<IconButton
						label={layers[0].isLocked ? 'Unlock Headline' : 'Lock Headline'}
						icon={layers[0].isLocked ? lockIcon : unlockIcon}
						variant="ghost"
						size="sm"
						onclick={() => toggleLock('headline')}
						class="ce-item-action ce-reveal{layers[0].isLocked
							? ' ce-reveal-shown'
							: ''}"
					/>
				{/snippet}
				{#snippet datelineEnd()}
					<IconButton
						label={layers[1].isLocked ? 'Unlock Dateline' : 'Lock Dateline'}
						icon={layers[1].isLocked ? lockIcon : unlockIcon}
						variant="ghost"
						size="sm"
						onclick={() => toggleLock('dateline')}
						class="ce-item-action ce-reveal{layers[1].isLocked
							? ' ce-reveal-shown'
							: ''}"
					/>
				{/snippet}
				{#snippet photoEnd()}
					<IconButton
						label={layers[2].isLocked ? 'Unlock Photo' : 'Lock Photo'}
						icon={layers[2].isLocked ? lockIcon : unlockIcon}
						variant="ghost"
						size="sm"
						onclick={() => toggleLock('photo')}
						class="ce-item-action ce-reveal{layers[2].isLocked
							? ' ce-reveal-shown'
							: ''}"
					/>
				{/snippet}
				{@const layerItems: TreeListItemData[] = [
					{
						id: 'group-text',
						label: 'Text',
						isExpanded: true,
						startContent: frameIcon,
						children: [
							{
								id: 'headline',
								label: 'Headline',
								isSelected: selectedID === 'headline',
								onClick: () => (selectedID = 'headline'),
								startContent: textStart,
								endContent: headlineEnd
							},
							{
								id: 'dateline',
								label: 'Dateline',
								isSelected: selectedID === 'dateline',
								onClick: () => (selectedID = 'dateline'),
								startContent: textStart,
								endContent: datelineEnd
							}
						]
					},
					{
						id: 'group-images',
						label: 'Images',
						isExpanded: true,
						startContent: frameIcon,
						children: [
							{
								id: 'photo',
								label: 'Photo',
								isSelected: selectedID === 'photo',
								onClick: () => (selectedID = 'photo'),
								startContent: imageStart,
								endContent: photoEnd
							}
						]
					}
				]}
				<TreeList density="compact" items={layerItems} />
			{:else}
				<List>
					{#each EFFECT_PRESETS as preset (preset.label)}
						{#snippet presetStart()}
							<Icon icon={preset.icon} size={ICON} color="secondary" />
						{/snippet}
						<Item
							as="li"
							density="compact"
							label={preset.label}
							startContent={presetStart}
						/>
					{/each}
				</List>
			{/if}
		</VStack>
	</LayoutPanel>
	<!--
		The panel draws the separator, so the handle stays divider-less and keeps
		its grip hidden until the pointer is on the seam.
	-->
	<ResizeHandle
		resizable={rail.props}
		isAlwaysVisible={false}
		pillPlacement="center"
		label="Resize layers panel"
		class="ce-folds-rail"
	/>
{/snippet}

{#snippet workspace()}
	<LayoutContent padding={0}>
		<Layout
			height="fill"
			start={chrome.left ? leftPanel : undefined}
			content={canvasContent}
			end={chrome.right ? rightPanel : undefined}
		/>
	</LayoutContent>
{/snippet}

{#snippet rightPanel()}
	<ResizeHandle
		resizable={inspector.props}
		isReversed
		isAlwaysVisible={false}
		pillPlacement="center"
		label="Resize properties panel"
		class="ce-folds-inspector"
	/>
	{@render inspectorPanel()}
{/snippet}

<!--
	Appearance drives a Theme around the whole editor, and that Theme needs a
	surface of its own. Panels and toolbars are transparent, so without one they
	keep showing the host page's background while their text takes the new mode's
	colour — light text on a light page. The Section paints the mode's own
	background, which is what makes the editor consistent.
-->
<Theme theme={neutralTheme} mode={appearance}>
	<Section variant="section" padding={0} height="100%">
		<Layout height="fill" padding={0} header={header} content={workspace} />
	</Section>
</Theme>

<style>
	/* Zoom the way a design tool does: the artboard lays out at its native size
	   and the painted result is scaled, so type and spacing stay in artboard
	   pixels and the poster gets no reflow between zoom steps. */
	:global(.ce-artboard-frame) {
		/* Card turns into a scroll container when given a height; this one is a
		   viewport onto an artboard deliberately larger than its frame, so it
		   clips. `clip` over `hidden`: nothing here should scroll, including the
		   quiet scroll that focusing a clipped child would otherwise cause. */
		overflow: clip;
	}
	:global(.ce-artboard-centered) {
		/* The canvas pans in both axes, which centring normally breaks: a scroll
		   port that centres with justify-content has no scrollable overflow on
		   the start side. Auto margins centre the same way while leaving that
		   overflow reachable. */
		margin: auto;
	}
	:global(.ce-canvas-stage) {
		min-width: 100%;
	}
	:global(.ce-header-lead) {
		min-width: 0;
	}
	:global(.ce-tab-strip) {
		min-width: 0;
		flex-shrink: 1;
		/* Short enough that a scrollbar would eat most of it, and the tabs are
		   draggable-looking targets already. */
		scrollbar-width: none;
	}
	:global(.ce-tab-rule) {
		height: 16px;
		align-self: center;
		flex-shrink: 0;
	}
	:global(.ce-tab-rule-hidden) {
		visibility: hidden;
	}
	/* Everything a tab needs beyond an Item: a width ceiling and a tighter
	   measure. Item brings the 28px box, the radius, the fill when selected, the
	   inline padding, and the ellipsis on a string label. */
	:global(.ce-tab) {
		gap: var(--spacing-1-5);
		padding-inline-end: var(--spacing-1);
		flex-grow: 0;
		flex-shrink: 1;
		width: 164px;
		min-width: 96px;
	}
	:global(.ce-tab:not(.ce-tab-selected):hover) {
		/* Item paints a fill when selected but leaves hover to the list that owns
		   it, and the strip is not a list. The tab is a target on its own. */
		background-color: var(--color-background-muted);
	}
	:global(.ce-tab-selected) {
		/* Item marks a selected row with --color-accent-muted, which this
		   editor's theme resolves to #262626 in dark — the exact colour of the
		   header bar the strip sits on, so the open document would read as no
		   document at all. The muted background is a step off the bar in both
		   schemes, and it is the fill hover already uses. */
		background-color: var(--color-background-muted);
	}
	/* Hold the label column at its set width. The fields beside it carry the flex
	   min-width reset, so without this the row spends its shrinkage on whichever
	   item gives way first and each label ends up a different width — which is
	   exactly the shared left edge the panel is built around. */
	:global(.ce-label-column) {
		flex-shrink: 0;
	}
	/* An action nested *inside* a row, as opposed to one standing beside a
	   field. The smallest IconButton is 28px, which is the whole row's height
	   budget once compact density adds its 4px above and below, so the control
	   is pulled back by the row's own padding token. */
	:global(.ce-item-action) {
		margin: calc(-1 * var(--spacing-1));
		/* Icon tokens, not the text ones a ghost Button reaches for. The two agree
		   at the theme root but this editor's theme separates them. */
		color: var(--color-icon-secondary);
	}
	:global(.ce-item-action:hover:not(:disabled)) {
		color: var(--color-icon-primary);
	}
	:global(.ce-item-action:disabled) {
		color: var(--color-icon-disabled);
	}
	/* The reveal the useContainerReveal hook performs upstream: hidden at rest,
	   shown while the row is pointed at or holds focus, pinned by
	   `ce-reveal-shown`, and always visible where hover cannot happen. */
	:global(.ce-reveal) {
		opacity: 0;
		transition: opacity var(--duration-short, 120ms) var(--ease-standard, ease);
	}
	:global(.astryx-item:hover) :global(.ce-reveal),
	:global(.astryx-item:focus-within) :global(.ce-reveal),
	:global(.astryx-tree-list-item:hover) :global(.ce-reveal),
	:global(.astryx-tree-list-item:focus-within) :global(.ce-reveal),
	:global(.ce-reveal-shown) {
		opacity: 1;
	}
	@media (hover: none) {
		:global(.ce-reveal) {
			opacity: 1;
		}
	}
	/* Folded by width, not by the View menu's toggles. Those record what the user
	   asked for; this records whether there is room to honour it, so the panel
	   comes back on its own when the window grows rather than leaving the toggle
	   switched off. Applied to the handle as well as the panel, or a grip is left
	   behind on a seam with nothing on the other side. */
	@media (max-width: 1099.98px) {
		:global(.ce-folds-inspector) {
			display: none;
		}
	}
	@media (max-width: 839.98px) {
		:global(.ce-folds-rail) {
			display: none;
		}
	}
	/* A chip for an unset slot reads as empty rather than as black. */
	:global(.ce-swatch) {
		width: var(--spacing-7);
		height: var(--spacing-7);
		flex-shrink: 0;
		padding: 0;
		border-width: 1px;
		border-style: solid;
		border-color: var(--color-border-emphasized);
		border-radius: var(--radius-element);
		cursor: pointer;
		background-image: linear-gradient(
			45deg,
			transparent 45%,
			var(--color-border-emphasized) 45% 55%,
			transparent 55%
		);
	}
	:global(.ce-swatch-filled) {
		background-image: none;
	}
	:global(.ce-plane-stack) {
		display: grid;
		gap: var(--spacing-3);
	}
	/* The saturation/value plane. White runs left to right and black bottom to
	   top over the pure hue, so every point in the square is one colour at that
	   hue. */
	:global(.ce-plane) {
		position: relative;
		height: 160px;
		border-radius: var(--radius-inner);
		background-image: linear-gradient(to top, #000, transparent),
			linear-gradient(to right, #fff, transparent);
		cursor: crosshair;
		touch-action: none;
	}
	/* Both thumbs are positioned by their centre, so the translate is what keeps
	   them on the value rather than beside it. */
	:global(.ce-plane-thumb) {
		position: absolute;
		width: var(--spacing-3);
		height: var(--spacing-3);
		border-width: 2px;
		border-style: solid;
		border-color: #fff;
		border-radius: var(--radius-full);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
	/* Concentric corners: the card rounds to --radius-container and holds one
	   spacing step of padding, so the controls inside it round to the
	   difference. */
	:global(.ce-tool-control) {
		border-radius: calc(var(--radius-container) - var(--spacing-1));
	}
	/* The trailing control is a ghost, so edge compensation pulls it out to the
	   card's edge. Putting the step back matches the two ends. */
	:global(.ce-tool-trailing) {
		margin-inline-end: var(--spacing-2);
	}
	/* A vertical Divider is height: 100%, and a flex row that centres its items
	   gives a percentage height nothing to resolve against — the rule collapses
	   to nothing and the tool bar loses its groups. */
	:global(.ce-tool-rule) {
		align-self: stretch;
		height: auto;
		margin-block: var(--spacing-1);
	}
</style>
