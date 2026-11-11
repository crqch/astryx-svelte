<!--
	Ported from upstream's `assets/templates/pages/table-filter/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Lucide throughout, as upstream's are: `@lucide/svelte` keeps the
	names, so the import below is upstream's with the package name changed.

	## The translations

	1. **StyleX is gone; the styles are ordinary CSS.** Every `stylex.create`
	   rule is a class in the `<style>` block at the bottom (or an inline `style`
	   string where a value interpolates). The classes are `tf-`-prefixed and
	   written `:global(...)` because most land on Astryx components, whose
	   classes Svelte never scopes. `xstyle={[a, b]}` became `class="a b"`;
	   `controlXstyle`/`contentXstyle` have no counterpart, so the few visual
	   overrides they carried are CSS on the control's stable classes or omitted
	   with a note at the site.

	2. **The filter bar's overflow carries data, not rendered nodes.** This
	   port's `OverflowList` takes `items` + an `item` snippet (its documented
	   divergence from upstream's compositional children). The row therefore
	   builds a `FilterEntry[]` describing each clause, and one
	   `filterControl(entry)` snippet renders a control both on the row and
	   inside the overflow panel — the same control, same state, same field.

	3. **Column reordering is expressed with data attributes and CSS.** The lab
	   package's `reorderStyles` (source fade, drop rule before/after) are
	   `tf-reorder-*` classes; the grip keeps its keyboard pick-up/drop and
	   pointer drag unchanged.

	4. **`MultiSelector.formatValue` is not implemented in this port** (recorded
	   in `port/todo.md`). The many-of selectors fall back to the component's own
	   `triggerDisplay="labels"`, so a clause with more than three values spells
	   three out before counting instead of the one-name-plus-count form upstream
	   requests. Nothing else about the control changes.

	5. **`useInfiniteBatches` is a rune helper.** It returns getters for `data`,
	   `hasNext` and `isLoadingNext`, and the same 500ms stand-in for Relay's
	   round trip. The sentinel's `IntersectionObserver` lives in an `$effect`.

	6. **`FilterOverflow`'s open state, the saved-view forms' fields and the
	   reorder session live on the page**, because each is a snippet here rather
	   than a component. The forms keep upstream's Dialog/BottomSheet split and
	   the sheet's `purpose="form"`.

	7. `BottomSheet` publishes no `padding` prop, so upstream's `padding={0}`
	   is dropped where it appears; the inner sections still own their insets.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		AspectRatio,
		Avatar,
		Badge,
		BottomSheet,
		Button,
		ComplexSelector,
		Dialog,
		DialogHeader,
		Divider,
		EmptyState,
		HStack,
		Heading,
		Icon,
		IconButton,
		Item,
		Layout,
		LayoutContent,
		LayoutHeader,
		LayoutPanel,
		Link,
		List,
		MetadataList,
		MetadataListItem,
		MultiSelector,
		OverflowList,
		Popover,
		PowerSearch,
		ProgressBar,
		RadioList,
		RadioListItem,
		ResizeHandle,
		Section,
		Selector,
		Skeleton,
		Slider,
		StackItem,
		StatusDot,
		Tab,
		TabList,
		Table,
		Text,
		TextInput,
		ToggleButton,
		Token,
		VStack,
		VisuallyHidden,
		pixel,
		proportional,
		useAnnounce,
		useMediaQuery,
		usePowerSearchConfig,
		useResizable,
		useTableGroupedRows,
		useTableSelection,
		useTableSelectionState,
		useTableSortable,
		useTableStickyColumns,
		type OverflowItem,
		type PowerSearchFilter,
		type SelectorOptionData,
		type TableColumn,
		type TablePlugin
	} from '@astryx-svelte/core';
	import {
		Bookmark,
		BookmarkPlus,
		Calendar,
		ChevronDown,
		CircleX,
		Columns3,
		GripVertical,
		Image as ImageIcon,
		Pencil,
		Pin,
		Plus,
		Search,
		SlidersHorizontal,
		Table as TableIcon,
		Table2,
		UserPlus,
		X
	} from '@lucide/svelte';

type JobStatus =
  'scheduled' | 'in_progress' | 'on_hold' | 'overdue' | 'completed';
type Priority = 'urgent' | 'high' | 'normal';

/** The authored shape. Dates are derived on load, so they live on ServiceJob. */
interface SeedJob {
  id: string;
  summary: string;
  customer: string;
  address: string;
  technician: string;
  status: JobStatus;
  priority: Priority;
  /** ISO timestamp — the column sorts on this, so it stays a string. */
  scheduledAt: string;
  /** Quote in whole dollars, kept numeric so it sorts and filters. */
  quoted: number;
  equipment: string;
}

interface ServiceJob extends SeedJob, Record<string, unknown> {
  /**
   * The same instant as scheduledAt, as a Date. Power search rejects a string
   * date outright, so the date filters read this field while the column reads
   * the string above.
   */
  scheduledOn: Date;
}

/**
 * The hue variants, not the semantic ones. `warning` and `error` paint a solid
 * fill straight from --color-warning / --color-error, and a theme is free to
 * tune those as ink for text rather than as a surface — the neutral theme does,
 * so Overdue comes out a muddy maroon block. The hue variants read their own
 * background/text pair, which is a tint in every theme, so a column of these
 * stays legible wherever the page is themed. Red is left to carry the one state
 * worth chasing.
 *
 * On hold is grey because nothing is wrong with it — the work is parked, not
 * late — and a colour there would pull the eye off the row that is.
 *
 * The happy path walks the hue wheel in the direction the work travels:
 * Scheduled blue, In progress teal, Completed green. Teal is the stop between
 * the other two, so the ramp reads as progress rather than as three unrelated
 * tags.
 */
const STATUS_META: Record<
  JobStatus,
  {
    label: string;
    badge: 'neutral' | 'blue' | 'teal' | 'green' | 'red';
  }
> = {
  scheduled: {label: 'Scheduled', badge: 'blue'},
  in_progress: {label: 'In progress', badge: 'teal'},
  on_hold: {label: 'On hold', badge: 'neutral'},
  overdue: {label: 'Overdue', badge: 'red'},
  completed: {label: 'Completed', badge: 'green'},
};

/**
 * Priority is a three-step ramp read down a column, which is what a dot is for:
 * the eye picks out the reds without reading a word. Normal is neutral, so a
 * table of ordinary work is quiet.
 */
const PRIORITY_META: Record<
  Priority,
  {label: string; dot: 'neutral' | 'warning' | 'error'}
> = {
  urgent: {label: 'Urgent', dot: 'error'},
  high: {label: 'High', dot: 'warning'},
  normal: {label: 'Normal', dot: 'neutral'},
};

/** Primary detail-pane action per state — keeps the panel feeling like a tool. */
const NEXT_ACTION: Record<JobStatus, string> = {
  scheduled: 'Dispatch technician',
  in_progress: 'Mark complete',
  on_hold: 'Check parts order',
  overdue: 'Reschedule',
  completed: 'Create follow-up',
};

// Active work first, then recent completed jobs referenced as site history.
const seedJobs: SeedJob[] = [
  {
    id: 'SJ-2148',
    summary: 'No cooling — rooftop unit 3',
    customer: 'Harborview Grand Hotel',
    address: '1200 Harbor Blvd, Bayside',
    technician: 'Luis Camarena',
    status: 'in_progress',
    priority: 'urgent',
    scheduledAt: '2026-07-02T08:00:00Z',
    quoted: 1480,
    equipment: 'Trane RTU-3, 25-ton (2019)',
  },
  {
    id: 'SJ-2147',
    summary: 'Quarterly preventive maintenance',
    customer: 'Northgate Dental Group',
    address: '88 Northgate Mall, Suite 210',
    technician: 'Dana Whitfield',
    status: 'scheduled',
    priority: 'normal',
    scheduledAt: '2026-07-02T10:30:00Z',
    quoted: 420,
    equipment: 'Carrier split system, 5-ton',
  },
  {
    id: 'SJ-2146',
    summary: 'Walk-in freezer overshooting setpoint',
    customer: 'Beacon Street Bistro',
    address: '412 Beacon St',
    technician: 'Marcus Osei',
    status: 'on_hold',
    priority: 'high',
    scheduledAt: '2026-07-01T13:00:00Z',
    quoted: 2150,
    equipment: 'Kolpak walk-in, Copeland compressor',
  },
  {
    id: 'SJ-2145',
    summary: 'Thermostat replacement, suite 400',
    customer: 'Pinnacle Property Mgmt',
    address: '500 Commerce Tower, Floor 4',
    technician: 'Dana Whitfield',
    status: 'scheduled',
    priority: 'normal',
    scheduledAt: '2026-07-02T14:00:00Z',
    quoted: 310,
    equipment: 'Honeywell T6 Pro (2 units)',
  },
  {
    id: 'SJ-2144',
    summary: 'Boiler pilot fails to stay lit',
    customer: 'Elm & 5th Lofts',
    address: '501 Elm St',
    technician: 'Luis Camarena',
    status: 'overdue',
    priority: 'high',
    scheduledAt: '2026-07-01T09:00:00Z',
    quoted: 760,
    equipment: 'Weil-McLain CGa boiler (2011)',
  },
  {
    id: 'SJ-2143',
    summary: 'Condenser coil cleaning',
    customer: 'Riverside Athletic Club',
    address: '9 Riverside Way',
    technician: 'Priya Raman',
    status: 'scheduled',
    priority: 'normal',
    scheduledAt: '2026-07-03T07:30:00Z',
    quoted: 540,
    equipment: 'Lennox RTU, 20-ton (2018)',
  },
  {
    id: 'SJ-2142',
    summary: 'Intermittent short cycling',
    customer: 'Harborview Grand Hotel',
    address: '1200 Harbor Blvd, Bayside',
    technician: 'Marcus Osei',
    status: 'on_hold',
    priority: 'high',
    scheduledAt: '2026-07-01T15:30:00Z',
    quoted: 890,
    equipment: 'Trane RTU-1, 25-ton (2019)',
  },
  {
    id: 'SJ-2141',
    summary: 'Emergency steam leak, basement',
    customer: 'Elm & 5th Lofts',
    address: '501 Elm St',
    technician: 'Priya Raman',
    status: 'in_progress',
    priority: 'urgent',
    scheduledAt: '2026-07-01T06:00:00Z',
    quoted: 3200,
    equipment: 'Weil-McLain CGa boiler (2011)',
  },
  {
    id: 'SJ-2140',
    summary: 'Annual fire damper inspection',
    customer: 'Pinnacle Property Mgmt',
    address: '500 Commerce Tower, Floor 4',
    technician: 'Dana Whitfield',
    status: 'scheduled',
    priority: 'normal',
    scheduledAt: '2026-07-06T09:00:00Z',
    quoted: 1250,
    equipment: 'Building-wide duct network',
  },
  {
    id: 'SJ-2139',
    summary: 'Ice machine not producing',
    customer: 'Beacon Street Bistro',
    address: '412 Beacon St',
    technician: 'Luis Camarena',
    status: 'overdue',
    priority: 'urgent',
    scheduledAt: '2026-06-30T11:00:00Z',
    quoted: 680,
    equipment: 'Hoshizaki KM-660, air cooled',
  },
  {
    id: 'SJ-2138',
    summary: 'Makeup air unit rebalancing',
    customer: 'Northgate Dental Group',
    address: '88 Northgate Mall, Suite 210',
    technician: 'Priya Raman',
    status: 'scheduled',
    priority: 'normal',
    scheduledAt: '2026-07-07T13:00:00Z',
    quoted: 495,
    equipment: 'Greenheck MAU, 4000 CFM',
  },
  {
    id: 'SJ-2137',
    summary: 'Chiller low refrigerant alarm',
    customer: 'Summit Medical Plaza',
    address: '77 Summit Ridge Rd',
    technician: 'Marcus Osei',
    status: 'in_progress',
    priority: 'urgent',
    scheduledAt: '2026-07-01T08:30:00Z',
    quoted: 4100,
    equipment: 'Daikin air-cooled chiller, 80-ton',
  },
  {
    id: 'SJ-2136',
    summary: 'VAV box actuator replacement',
    customer: 'Summit Medical Plaza',
    address: '77 Summit Ridge Rd',
    technician: 'Dana Whitfield',
    status: 'scheduled',
    priority: 'high',
    scheduledAt: '2026-07-03T10:00:00Z',
    quoted: 720,
    equipment: 'Titus VAV, zones 12–15',
  },
  {
    id: 'SJ-2135',
    summary: 'Exhaust fan bearing noise',
    customer: 'Riverside Athletic Club',
    address: '9 Riverside Way',
    technician: 'Luis Camarena',
    status: 'on_hold',
    priority: 'normal',
    scheduledAt: '2026-06-30T14:30:00Z',
    quoted: 380,
    equipment: 'Greenheck exhaust fan, pool deck',
  },
  {
    id: 'SJ-2134',
    summary: 'Humidifier control board fault',
    customer: 'Summit Medical Plaza',
    address: '77 Summit Ridge Rd',
    technician: 'Priya Raman',
    status: 'overdue',
    priority: 'high',
    scheduledAt: '2026-06-29T09:30:00Z',
    quoted: 1340,
    equipment: 'DriSteem steam humidifier',
  },
  {
    id: 'SJ-2133',
    summary: 'Rooftop economizer stuck closed',
    customer: 'Northgate Dental Group',
    address: '88 Northgate Mall, Suite 210',
    technician: 'Marcus Osei',
    status: 'scheduled',
    priority: 'normal',
    scheduledAt: '2026-07-08T08:00:00Z',
    quoted: 610,
    equipment: 'Carrier split system, 5-ton',
  },
  {
    id: 'SJ-2132',
    summary: 'Hot water recirculation pump seized',
    customer: 'Elm & 5th Lofts',
    address: '501 Elm St',
    technician: 'Dana Whitfield',
    status: 'in_progress',
    priority: 'high',
    scheduledAt: '2026-07-01T12:00:00Z',
    quoted: 950,
    equipment: 'Taco 007 circulator',
  },
  {
    id: 'SJ-2131',
    summary: 'Split system quote, new tenant build',
    customer: 'Pinnacle Property Mgmt',
    address: '500 Commerce Tower, Floor 4',
    technician: 'Priya Raman',
    status: 'scheduled',
    priority: 'normal',
    scheduledAt: '2026-07-09T11:00:00Z',
    quoted: 8600,
    equipment: 'Proposed: Mitsubishi VRF, 6 zones',
  },
  {
    id: 'SJ-2101',
    summary: 'Compressor contactor replacement',
    customer: 'Harborview Grand Hotel',
    address: '1200 Harbor Blvd, Bayside',
    technician: 'Marcus Osei',
    status: 'completed',
    priority: 'high',
    scheduledAt: '2026-06-24T09:00:00Z',
    quoted: 640,
    equipment: 'Trane RTU-3, 25-ton (2019)',
  },
  {
    id: 'SJ-2095',
    summary: 'Pool dehumidifier service',
    customer: 'Riverside Athletic Club',
    address: '9 Riverside Way',
    technician: 'Dana Whitfield',
    status: 'completed',
    priority: 'normal',
    scheduledAt: '2026-06-22T08:00:00Z',
    quoted: 720,
    equipment: 'Seresco NP series dehumidifier',
  },
  {
    id: 'SJ-2088',
    summary: 'Refrigerant leak diagnostic',
    customer: 'Beacon Street Bistro',
    address: '412 Beacon St',
    technician: 'Luis Camarena',
    status: 'completed',
    priority: 'normal',
    scheduledAt: '2026-06-18T11:00:00Z',
    quoted: 390,
    equipment: 'Kolpak walk-in, Copeland compressor',
  },
  {
    id: 'SJ-2081',
    summary: 'Chiller annual certification',
    customer: 'Summit Medical Plaza',
    address: '77 Summit Ridge Rd',
    technician: 'Priya Raman',
    status: 'completed',
    priority: 'high',
    scheduledAt: '2026-06-15T07:00:00Z',
    quoted: 2450,
    equipment: 'Daikin air-cooled chiller, 80-ton',
  },
  {
    id: 'SJ-2067',
    summary: 'RTU belt and filter service',
    customer: 'Pinnacle Property Mgmt',
    address: '500 Commerce Tower, Floor 4',
    technician: 'Dana Whitfield',
    status: 'completed',
    priority: 'normal',
    scheduledAt: '2026-06-12T08:30:00Z',
    quoted: 280,
    equipment: 'York RTU, 15-ton (2016)',
  },
  {
    id: 'SJ-2044',
    summary: 'Cooling tower fan bearing replacement',
    customer: 'Harborview Grand Hotel',
    address: '1200 Harbor Blvd, Bayside',
    technician: 'Marcus Osei',
    status: 'completed',
    priority: 'high',
    scheduledAt: '2026-05-28T07:30:00Z',
    quoted: 1120,
    equipment: 'BAC cooling tower, cell 2',
  },
  {
    id: 'SJ-2019',
    summary: 'Spring maintenance visit',
    customer: 'Northgate Dental Group',
    address: '88 Northgate Mall, Suite 210',
    technician: 'Dana Whitfield',
    status: 'completed',
    priority: 'normal',
    scheduledAt: '2026-04-15T10:00:00Z',
    quoted: 420,
    equipment: 'Carrier split system, 5-ton',
  },
];

const DAY_MS = 86_400_000;

/** Read once at load, so a preset's filter value stays referentially stable. */
const NOW_MS = Date.now();

/**
 * The authored dates are fixed, so they slide into the past as this template
 * ages and an "Upcoming" filter would match nothing. Shifting the whole set on
 * load keeps the backlog straddling today, with the newest job about three
 * weeks out.
 */
const DATE_SHIFT_MS =
  NOW_MS +
  21 * DAY_MS -
  Math.max(...seedJobs.map(j => Date.parse(j.scheduledAt)));

/**
 * A job in the past can't still be waiting to happen, and one from months ago
 * isn't still under way, so an authored status only survives where the shifted
 * date still supports it.
 */
function statusForDate(authored: JobStatus, when: number): JobStatus {
  if (when > NOW_MS) {
    return 'scheduled';
  }
  // Recently missed work is still chaseable; anything older has been closed
  // out one way or another.
  const isRecent = when > NOW_MS - 45 * DAY_MS;
  if (authored === 'scheduled') {
    return isRecent ? 'overdue' : 'completed';
  }
  if (authored === 'in_progress' && !isRecent) {
    return 'completed';
  }
  return authored;
}

/**
 * The authored rows are cycled backwards through the calendar into a longer
 * backlog, so the infinite scroll below has several batches to fetch. A real
 * screen gets this from its Relay connection instead.
 */
const allJobs: ServiceJob[] = Array.from({length: 5}, (_, cycle) =>
  seedJobs.map((job, index) => {
    // The per-row term decorrelates the cycles, so repeat visits to the same
    // site spread across the calendar instead of stacking up next to each
    // other once the table sorts by date.
    const cycleDays = cycle === 0 ? 0 : cycle * 37 + ((index * 13) % 29);
    const when =
      Date.parse(job.scheduledAt) + DATE_SHIFT_MS - cycleDays * DAY_MS;
    const scheduledOn = new Date(when);
    return {
      ...job,
      id:
        cycle === 0
          ? job.id
          : `SJ-${1999 - (cycle - 1) * seedJobs.length - index}`,
      status: statusForDate(job.status, when),
      scheduledAt: scheduledOn.toISOString(),
      scheduledOn,
      quoted: cycle === 0 ? job.quoted : job.quoted + ((index * 17) % 9) * 10,
    };
  }),
).flat();

const TECHNICIANS = Array.from(new Set(allJobs.map(j => j.technician))).sort();
const CUSTOMERS = Array.from(new Set(allJobs.map(j => j.customer))).sort();

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * UTC-based formatters, so the fixed fixtures render identically everywhere.
 * A locale-aware Timestamp would shift these by the viewer's offset and then
 * disagree with the table column beside it.
 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const suffix = hours < 12 ? 'am' : 'pm';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes}${suffix}`;
}

function formatDate(iso: string, withYear = false): string {
  const d = new Date(iso);
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${base}, ${d.getUTCFullYear()}` : base;
}

const formatScheduled = (iso: string) =>
  `${formatDate(iso)}, ${formatTime(iso)}`;

const formatMoney = (amount: number) => `$${amount.toLocaleString('en-US')}`;

// =============================================================================
// Filter configuration
//
// One config backs both the token list and power search, so the two are always
// describing the same filter array.
// =============================================================================

const fieldDefs = [
  {key: 'summary', type: 'string', label: 'Summary'},
  {
    key: 'customer',
    type: 'enum',
    label: 'Customer',
    enumValues: CUSTOMERS.map(v => ({value: v, label: v})),
  },
  {
    key: 'technician',
    type: 'enum',
    label: 'Technician',
    enumValues: TECHNICIANS.map(v => ({value: v, label: v})),
  },
  {
    key: 'status',
    type: 'enum',
    label: 'Status',
    enumValues: (Object.keys(STATUS_META) as JobStatus[]).map(v => ({
      value: v,
      label: STATUS_META[v].label,
    })),
  },
  {
    key: 'priority',
    type: 'enum',
    label: 'Priority',
    enumValues: (Object.keys(PRIORITY_META) as Priority[]).map(v => ({
      value: v,
      label: PRIORITY_META[v].label,
    })),
  },
  {key: 'quoted', type: 'number', label: 'Quote'},
  {key: 'scheduledOn', type: 'date', label: 'Scheduled'},
] as const;

/** Bounds for the quote range slider, snapped outward to round money. */
const QUOTE_MIN = 0;
const QUOTE_MAX =
  Math.ceil(Math.max(...allJobs.map(j => j.quoted)) / 500) * 500;
const QUOTE_STEP = 100;

/**
 * A single-value field in the filter bar, rendered as a Button-triggered
 * dropdown so the closed trigger doubles as the chip. Quote sits outside this
 * list — it is a range, not a pick — and so do the many-of fields below.
 */
interface FilterField {
  key: string;
  label: string;
  operator: string;
  operatorLabel: string;
  /** Filter value type handed to power search, so both modes agree. */
  valueType: 'enum' | 'integer';
  options: ReadonlyArray<{value: string; label: string}>;
}

const FILTER_FIELDS: readonly FilterField[] = [
  {
    key: 'priority',
    label: 'Priority',
    operator: 'is',
    operatorLabel: 'is',
    valueType: 'enum',
    options: (Object.keys(PRIORITY_META) as Priority[]).map(v => ({
      value: v,
      label: PRIORITY_META[v].label,
    })),
  },
];

/**
 * Fields a reader narrows by picking several at once — "show me on hold and
 * overdue", "these two crews". Priority stays single because its three steps
 * are a ramp: picking two of three is the same as excluding one, which the
 * table already shows.
 *
 * `is_any_of` is what lets a field hold more than one value. applyFilters ANDs
 * same-field clauses, so a second `is` would contradict the first rather than
 * widen it.
 */
const MULTI_FILTER_FIELDS: ReadonlyArray<{
  key: string;
  label: string;
  options: ReadonlyArray<{value: string; label: string}>;
}> = [
  {
    key: 'status',
    label: 'Status',
    options: (Object.keys(STATUS_META) as JobStatus[]).map(v => ({
      value: v,
      label: STATUS_META[v].label,
    })),
  },
  {
    key: 'customer',
    label: 'Customer',
    options: CUSTOMERS.map(v => ({value: v, label: v})),
  },
  {
    key: 'technician',
    label: 'Technician',
    options: TECHNICIANS.map(v => ({value: v, label: v})),
  },
];

/**
 * A canned filter offered as a one-click toggle, with field, operator and value
 * all fixed up front. Each preset owns a field no other control in the bar
 * touches — a preset on status or priority would fight the dropdown that also
 * writes that field, since one clause per field is all either can express.
 */
const PRESET_FILTERS: ReadonlyArray<{
  key: string;
  label: string;
  filter: PowerSearchFilter;
}> = [
  {
    key: 'upcoming',
    label: 'Upcoming',
    filter: {
      field: 'scheduledOn',
      operator: 'after',
      value: {type: 'date_absolute', unixSeconds: Math.floor(NOW_MS / 1000)},
    },
  },
];

/** Human-readable value for a filter chip label. */
const VALUE_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    (Object.keys(STATUS_META) as JobStatus[]).map(k => [
      k,
      STATUS_META[k].label,
    ]),
  ),
  ...Object.fromEntries(
    (Object.keys(PRIORITY_META) as Priority[]).map(k => [
      k,
      PRIORITY_META[k].label,
    ]),
  ),
};

// =============================================================================
// Bulk edit actions
// =============================================================================

const BULK_EDIT_ACTIONS: ReadonlyArray<{
  key: string;
  label: string;
  icon: typeof UserPlus;
  onClick: (selected: ServiceJob[]) => void;
}> = [
  {
    key: 'assign',
    label: 'Assign',
    icon: UserPlus,
    onClick: s => alert(`Assign technician: ${s.map(j => j.id).join(', ')}`),
  },
  {
    key: 'reschedule',
    label: 'Reschedule',
    icon: Calendar,
    onClick: s => alert(`Reschedule: ${s.map(j => j.id).join(', ')}`),
  },
  {
    key: 'cancel',
    label: 'Cancel',
    icon: CircleX,
    onClick: s => alert(`Cancel: ${s.map(j => j.id).join(', ')}`),
  },
];

// =============================================================================
// View options
// =============================================================================

type ViewSection = 'columns' | 'density' | 'sticky' | 'grouping';
type Density = 'compact' | 'balanced' | 'spacious';
type StickyEdge = 'none' | 'one' | 'two';
/** Field the rows section under. 'none' leaves the table flat. */
type GroupField = 'none' | 'status' | 'priority' | 'technician' | 'customer';

const VIEW_SECTIONS: ReadonlyArray<{
  key: ViewSection;
  label: string;
  icon: typeof Columns3;
  title: string;
}> = [
  {
    key: 'columns',
    label: 'Columns',
    icon: Columns3,
    title: 'Columns',
  },
  {
    key: 'density',
    label: 'Density',
    icon: TableIcon,
    title: 'Density',
  },
  {
    key: 'sticky',
    label: 'Sticky Columns',
    icon: Pin,
    title: 'Sticky Columns',
  },
  {
    key: 'grouping',
    label: 'Grouping',
    icon: Table2,
    title: 'Grouping',
  },
];

const DENSITY_OPTIONS: ReadonlyArray<{value: Density; label: string}> = [
  {value: 'compact', label: 'Compact'},
  {value: 'balanced', label: 'Balanced'},
  {value: 'spacious', label: 'Spacious'},
];

/**
 * Split by edge, because an edge names its own columns — "First two columns"
 * against the start, "Last two columns" against the end. Naming them here is
 * what lets the radio list and a saved view's summary state a frozen edge in
 * the same words.
 */
const STICKY_START_OPTIONS: ReadonlyArray<{
  value: StickyEdge;
  label: string;
}> = [
  {value: 'none', label: 'None'},
  {value: 'one', label: 'First column'},
  {value: 'two', label: 'First two columns'},
];

const STICKY_END_OPTIONS: ReadonlyArray<{value: StickyEdge; label: string}> = [
  {value: 'none', label: 'None'},
  {value: 'one', label: 'Last column'},
  {value: 'two', label: 'Last two columns'},
];

const GROUPING_OPTIONS: ReadonlyArray<{value: GroupField; label: string}> = [
  {value: 'none', label: 'None'},
  {value: 'status', label: 'Status'},
  {value: 'priority', label: 'Priority'},
  {value: 'technician', label: 'Technician'},
  {value: 'customer', label: 'Customer'},
];

/**
 * The words a section is titled with. The group key is what the heading prints,
 * so it has to be the label and not the stored value — grouping by status would
 * otherwise head its sections "on_hold". Technician and customer are stored as
 * their own labels already, which is what the fallback covers.
 */
function groupKeyOf(job: ServiceJob, field: GroupField): string {
  if (field === 'none') {
    return '';
  }
  const stored = String(job[field]);
  return VALUE_LABELS[stored] ?? stored;
}

/**
 * Section order per field. Without it the sections would come out in whatever
 * order the active sort happened to surface them, so status and priority take
 * their canonical severity order and the two name fields stay alphabetical.
 *
 * Listed as labels, because that is what groupKeyOf produces and these have to
 * match it to rank anything.
 */
const GROUP_ORDERS: Record<GroupField, string[]> = {
  none: [],
  status: Object.keys(STATUS_META).map(k => VALUE_LABELS[k] ?? k),
  priority: Object.keys(PRIORITY_META).map(k => VALUE_LABELS[k] ?? k),
  technician: TECHNICIANS,
  customer: CUSTOMERS,
};

/** Row-key prefix the grouped-rows plugin gives its synthetic header rows. */
const GROUP_ROW_KEY_PREFIX = '__group_';

/** Fed to the grouping hook while grouping is off, so it flattens nothing. */
const NO_ROWS: ServiceJob[] = [];

const COLUMN_LABELS: Record<string, string> = {
  summary: 'Job',
  customer: 'Customer',
  technician: 'Technician',
  status: 'Status',
  priority: 'Priority',
  scheduledAt: 'Scheduled',
  quoted: 'Quote',
  equipment: 'Equipment',
  address: 'Address',
};

const ALL_COLUMN_KEYS = [
  'summary',
  'customer',
  'technician',
  'status',
  'priority',
  'scheduledAt',
  'quoted',
  'equipment',
  'address',
];
const DEFAULT_COLUMN_KEYS = [
  'summary',
  'customer',
  'technician',
  'status',
  'priority',
  'scheduledAt',
  'quoted',
];

/**
 * The column that names the row. A table of jobs with no job on it is a table
 * of orphaned attributes, so this one stays: its remove control is disabled and
 * says why. Position is not identity, so it still reorders like any other.
 */
const LOCKED_COLUMN_KEY = 'summary';
const LOCKED_COLUMN_MESSAGE = 'Job names every row, so it cannot be removed.';

/** Pointer travel before a press on the grip becomes a drag rather than a tap. */
const REORDER_DRAG_THRESHOLD = 5;

/**
 * A reorder in flight. Positions are indices into the *visible* displayed list
 * — the one the reader is looking at — so a search that hides rows cannot make
 * the arrow keys or the drop indicator point somewhere off screen.
 */
interface ColumnReorderSession {
  key: string;
  mode: 'keyboard' | 'pointer';
  /** Visible order as it was when the drag began; the drag reads from this. */
  originalKeys: string[];
  fromIndex: number;
  toIndex: number;
  pointerId?: number;
  pointerStartY?: number;
  hasPointerMoved?: boolean;
}

/** Draft of every view option, so the panel can Cancel without touching the table. */
interface ViewState {
  columnKeys: string[];
  density: Density;
  stickyStart: StickyEdge;
  stickyEnd: StickyEdge;
  grouping: GroupField;
}

const INITIAL_VIEW: ViewState = {
  columnKeys: DEFAULT_COLUMN_KEYS,
  density: 'balanced',
  stickyStart: 'one',
  stickyEnd: 'none',
  grouping: 'customer',
};

/**
 * The screen opens on open work — every status except Completed. Landing on a
 * list of closed jobs is a poor first impression, and an unfiltered table
 * shows the filter bar in its resting state, which hides the chip, the result
 * count and Clear all behind a click. The saved-view baseline is the same set,
 * so the template arrives already demonstrating what it is for.
 */
const INITIAL_FILTERS: PowerSearchFilter[] = [
  {
    field: 'status',
    operator: 'is_any_of',
    value: {
      type: 'enum_list',
      value: (Object.keys(STATUS_META) as JobStatus[]).filter(
        status => status !== 'completed',
      ),
    },
  },
];

/**
 * Severity order for the enum columns, because their labels do not sort into
 * it. Alphabetically Priority runs High, Normal, Urgent — which files the rows
 * that matter in the middle. Rank is what a reader means by "sort by
 * priority", so the comparator reaches for this before falling back to a
 * string compare.
 */
const SORT_RANKS: Record<string, Record<string, number>> = {
  priority: {urgent: 0, high: 1, normal: 2},
  status: {overdue: 0, on_hold: 1, in_progress: 2, scheduled: 3, completed: 4},
};

const PAGE_SIZE = 15;

/** Key the selection plugin gives the checkbox column it prepends. */
const SELECTION_COLUMN_KEY = '__xds_selection';

// =============================================================================
// Saved views
//
// Declared after ViewState so a saved view can carry one. A view is the whole
// configuration of the screen, not just its filters: the columns on show and
// their order, plus density, sticky edges and grouping. That is what makes a
// column preset redundant — the columns travel with the view that named them.
// =============================================================================

interface SavedView {
  id: string;
  name: string;
  filters: PowerSearchFilter[];
  /** Columns, density, sticky edges and grouping as they were when saved. */
  view: ViewState;
}

const INITIAL_SAVED_VIEWS: SavedView[] = [
  {
    id: 'needs-dispatch',
    name: 'Needs dispatch',
    filters: [
      {
        field: 'status',
        operator: 'is',
        value: {type: 'enum', value: 'scheduled'},
      },
    ],
    view: INITIAL_VIEW,
  },
  {
    id: 'luis-open',
    name: "Luis's jobs",
    filters: [
      {
        field: 'technician',
        operator: 'is',
        value: {type: 'enum', value: 'Luis Camarena'},
      },
    ],
    // Technician is redundant once every row is Luis, and the shape of the day
    // is what this view is for, so it drops that column and groups by status.
    view: {
      ...INITIAL_VIEW,
      columnKeys: DEFAULT_COLUMN_KEYS.filter(k => k !== 'technician'),
      grouping: 'status',
    },
  },
  {
    id: 'high-value',
    name: 'High value',
    filters: [
      {
        // Same operator the range slider writes, so loading this view moves
        // the slider's low thumb instead of leaving it looking untouched.
        field: 'quoted',
        operator: 'greater_than_or_equal',
        value: {type: 'integer', value: 1000},
      },
    ],
    // Money is the point here, so the quote column is pinned to the end edge
    // and the rows tighten up to get more of them under the eye at once.
    view: {...INITIAL_VIEW, density: 'compact', stickyEnd: 'one'},
  },
];

// =============================================================================
// Helpers
// =============================================================================

/**
 * The surfaces below swap to a bottom sheet on a compact surface.
 *
 * Two terms, because there are two ways to be one. The second is the query the
 * Dialog adaptive-presentation block uses — up to `lg` on a device whose
 * pointer is a finger — and it is what catches a tablet that has the width for
 * a popover but no hover to drive one.
 *
 * The first is width alone, at any input. A 660px popover and a resizable side
 * panel need room the window no longer has well before the pointer changes:
 * below `md` the popover has nowhere to sit, and the panel leaves the table a
 * couple of columns wide. A mouse does not rescue a layout that does not fit,
 * so the narrow window gets sheets too.
 */
const COMPACT_SURFACE_QUERY =
  '(max-width: 768px), (max-width: 1024px) and (pointer: coarse) and (hover: none)';

/**
 * Width the filter row holds back, in px, for the readout that trails the
 * clauses — the density toggle, the result count and Clear all.
 *
 * The readout sits inside the slot the overflow list measures, so without this
 * the list would count the readout's width as room for another clause and
 * push it off the end. The slot pays for it as padding, which is the one part
 * of the slot the measurement already subtracts, and the readout takes the
 * width back with a matching negative margin so it still lands against the
 * last clause instead of at the far edge.
 *
 * Deliberately a little wider than the readout draws at the counts this page
 * reaches, because the two failure directions are not symmetric: too wide only
 * folds a clause marginally early, while too narrow puts the readout over the
 * edge of the row.
 */
const READOUT_RESERVE = 184;

/**
 * Each value is looked up before the join, not after: a many-of clause carries
 * a list of enum keys, and joining first would hand VALUE_LABELS the string
 * "on_hold, overdue", miss, and print the wire names.
 */
function filterValueText(filter: PowerSearchFilter): string {
  const raw = (filter.value as {value?: unknown}).value;
  const label = (v: unknown) => {
    const key = String(v ?? '');
    return VALUE_LABELS[key] ?? key;
  };
  return Array.isArray(raw) ? raw.map(label).join(', ') : label(raw);
}

/** Reads as the operator does in a power search token, not as its wire name. */
const OPERATOR_LABELS: Record<string, string> = {
  is: 'is',
  is_any_of: 'is any of',
  greater_than_or_equal: '≥',
  less_than_or_equal: '≤',
  after: 'after',
};

/**
 * One clause phrased the way power search phrases it, so a saved view's filters
 * read the same wherever they are shown. Money is formatted per field rather
 * than by sniffing the number, since a bare 1000 under Quote and under a count
 * are different things.
 */
function filterTokenLabel(filter: PowerSearchFilter): string {
  const field = fieldDefs.find(f => f.key === filter.field);
  const name = field?.label ?? filter.field;
  const operator = OPERATOR_LABELS[filter.operator] ?? filter.operator;
  const raw = filter.value as {value?: unknown; unixSeconds?: number};
  let value: string;
  if (typeof raw.unixSeconds === 'number') {
    // A date clause carries unixSeconds rather than `value`, so it would
    // otherwise render as a bare "Scheduled after" with nothing after it.
    value = formatDate(new Date(raw.unixSeconds * 1000).toISOString(), true);
  } else if (Array.isArray(raw.value) && raw.value.length > 1) {
    // Spelling out every selection makes a token wider than the dialog, and a
    // token that ellipsises mid-name is worse than an honest count.
    const [first, ...rest] = raw.value.map(v => VALUE_LABELS[String(v)] ?? v);
    value = `${first} +${rest.length}`;
  } else if (field?.type === 'number' && typeof raw.value === 'number') {
    value = formatMoney(raw.value);
  } else {
    value = filterValueText(filter);
  }
  return `${name} ${operator} ${value}`;
}

const stickyKeys = (
  edge: StickyEdge,
  keys: string[],
  fromEnd: boolean,
): string[] => {
  const count = edge === 'one' ? 1 : edge === 'two' ? 2 : 0;
  if (count === 0) {
    return [];
  }
  return fromEnd ? keys.slice(-count) : keys.slice(0, count);
};
// =============================================================================
// Svelte helpers and page state
// =============================================================================

/**
 * Stands in for Relay's `usePaginationFragment` so the table can grow by
 * batches instead of flipping pages. The same `{data, hasNext, isLoadingNext,
 * loadNext}` shape a Relay connection does, so a real screen swaps this helper
 * for the fragment and keeps everything below unchanged.
 */
function useInfiniteBatches<T>(
	items: () => readonly T[],
	pageSize: number,
	getGroupKey: () => ((item: T) => string) | null
): {
	readonly data: T[];
	readonly hasNext: boolean;
	readonly isLoadingNext: boolean;
	loadNext: (count: number) => void;
} {
	let loadedCount = $state(pageSize);
	let isLoadingNext = $state(false);
	let inFlight = false;

	// A new filter/sort result is a new connection: start from the first batch.
	$effect(() => {
		items();
		pageSize;
		inFlight = false;
		isLoadingNext = false;
		loadedCount = pageSize;
	});

	// A cut that lands mid-section leaves that section half-filled, and a reader
	// has no way to tell one that is still arriving from one that is genuinely
	// short — so the rows they can see are not a section they can trust. Carry
	// the cut to the end of whichever section it lands in. Sections are
	// contiguous because `results` sorts by group first.
	const visibleCount = $derived.by(() => {
		const all = items();
		if (loadedCount >= all.length) {
			return all.length;
		}
		const groupKey = getGroupKey();
		if (groupKey == null) {
			return loadedCount;
		}
		const openKey = groupKey(all[loadedCount - 1]);
		let end = loadedCount;
		while (end < all.length && groupKey(all[end]) === openKey) {
			end++;
		}
		return end;
	});

	const loadNext = (count: number) => {
		if (inFlight) {
			return;
		}
		inFlight = true;
		isLoadingNext = true;
		const base = visibleCount;
		// Stands in for the network round trip Relay would make here.
		setTimeout(() => {
			loadedCount = base + count;
			isLoadingNext = false;
			inFlight = false;
		}, 500);
	};

	return {
		get data() {
			return items().slice(0, visibleCount);
		},
		get hasNext() {
			return visibleCount < items().length;
		},
		get isLoadingNext() {
			return isLoadingNext;
		},
		loadNext
	};
}

const isCompactSurface = useMediaQuery(() => COMPACT_SURFACE_QUERY);

// --- Filtering -------------------------------------------------------------
let filters = $state<PowerSearchFilter[]>(INITIAL_FILTERS);
let isPowerSearch = $state(false);
let query = $state('');

// --- Saved views -----------------------------------------------------------
let savedViews = $state<SavedView[]>(INITIAL_SAVED_VIEWS);
let isSavedViewsBarOpen = $state(false);
let activeSavedViewId = $state<string | null>(null);
let creatingName = $state<string | null>(null);
let editing = $state<SavedView | null>(null);

// --- Selection -------------------------------------------------------------
let selectedKeys = $state<Set<string>>(new Set());

/** Row whose details are open in the end panel. Independent of bulk selection. */
let activeJobId = $state<string | null>(null);

// The floor keeps the MetadataList's 104px label column from squeezing its
// values below a readable line; the ceiling stops the panel from taking so much
// room that the table loses its sortable columns.
const detailWidth = useResizable(() => ({
	defaultSize: 380,
	minSizePx: 320,
	maxSizePx: 560
}));

// --- Sorting ---------------------------------------------------------------
let sort = $state<Array<{ sortKey: string; direction: 'ascending' | 'descending' }>>([
	{ sortKey: 'priority', direction: 'ascending' }
]);

// --- View options ----------------------------------------------------------
let view = $state<ViewState>(INITIAL_VIEW);
let viewSection = $state<ViewSection>('columns');
let isViewOpen = $state(false);
/**
 * The column reorder in flight, if any. Held in a plain variable as well as
 * state because a pointermove reads the session it is continuing before the
 * render has caught up with the one the previous move wrote.
 */
let reorderSession = $state<ColumnReorderSession | null>(null);
let reorderSessionRef: ColumnReorderSession | null = null;
/** Live row elements of the displayed list, so a drag can measure them. */
const columnRowRefs = new Map<string, HTMLElement>();
/** A drag ends in a click the grip must not read as a keyboard pick-up. */
let suppressGripClick = false;
const announce = useAnnounce();
const idPrefix = $props.id();
const columnPanelId = `${idPrefix}-columns`;
/**
 * Only the sheet's strip is a tablist, so only its panel carries this id. The
 * popover renders the same body without one, which is what keeps the id
 * unique: a closed BottomSheet still renders its children, so both copies of
 * the panel are in the document at once whenever the popover is open.
 */
const viewPanelId = `${idPrefix}-view-panel`;
/** Group keys the reader has folded shut. Empty means every section is open. */
let collapsedGroups = $state<Set<string>>(new Set());

// --- Misc ------------------------------------------------------------------
let isLoading = $state(false);

const powerSearch = usePowerSearchConfig(() => fieldDefs, () => 'Jobs');

// A filter change refetches; the top progress bar stands in for that.
$effect(() => {
	filters;
	query;
	isLoading = true;
	const timer = setTimeout(() => (isLoading = false), 450);
	return () => clearTimeout(timer);
});

const groupField = $derived(view.grouping);
const isGrouped = $derived(groupField !== 'none');

const results = $derived.by(() => {
	const byFilters = powerSearch.applyFilters(filters, allJobs);
	const q = query.trim().toLowerCase();
	const byQuery = q
		? byFilters.filter(
				(j) =>
					j.summary.toLowerCase().includes(q) ||
					j.customer.toLowerCase().includes(q) ||
					j.id.toLowerCase().includes(q)
			)
		: byFilters;
	if (sort.length === 0 && !isGrouped) {
		return byQuery;
	}
	// Grouping sorts before the user's own keys, which is what keeps a
	// section's rows contiguous in the result set. Batches then fill the
	// sections in order and always land at the bottom of the table.
	const groupRank = isGrouped
		? new Map(GROUP_ORDERS[groupField].map((key, i) => [key, i]))
		: null;
	return [...byQuery].sort((a, b) => {
		if (groupRank != null) {
			const cmp =
				(groupRank.get(groupKeyOf(a, groupField)) ?? Number.MAX_SAFE_INTEGER) -
				(groupRank.get(groupKeyOf(b, groupField)) ?? Number.MAX_SAFE_INTEGER);
			if (cmp !== 0) {
				return cmp;
			}
		}
		for (const { sortKey, direction } of sort) {
			const av = a[sortKey];
			const bv = b[sortKey];
			const rank = SORT_RANKS[sortKey];
			let cmp: number;
			if (rank != null) {
				// An unranked value sorts last rather than first, so a value the
				// map has not heard of cannot displace Urgent at the top.
				cmp =
					(rank[String(av)] ?? Number.MAX_SAFE_INTEGER) -
					(rank[String(bv)] ?? Number.MAX_SAFE_INTEGER);
			} else if (typeof av === 'number' && typeof bv === 'number') {
				cmp = av - bv;
			} else {
				cmp = String(av ?? '').localeCompare(String(bv ?? ''));
			}
			if (cmp !== 0) {
				return direction === 'ascending' ? cmp : -cmp;
			}
		}
		return 0;
	});
});

// Grouped, the page unit is the section; flat, it is the row. Passing the key
// only while grouping keeps an ungrouped view on even page sizes.
const batchGroupKey = $derived(
	isGrouped ? (job: ServiceJob) => groupKeyOf(job, groupField) : null
);

const batches = useInfiniteBatches<ServiceJob>(
	() => results,
	PAGE_SIZE,
	() => batchGroupKey
);
const rows = $derived(batches.data);
const hasNext = $derived(batches.hasNext);
const isLoadingNext = $derived(batches.isLoadingNext);
const loadNext = batches.loadNext;

// The sentinel sits under the last row; when it scrolls into view the next
// batch loads. The root stays the viewport so this works whether the page
// scrolls or the LayoutContent scrolls inside a height-constrained shell.
let sentinelEl = $state<HTMLElement | null>(null);
$effect(() => {
	if (sentinelEl == null || !hasNext) {
		return;
	}
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				loadNext(PAGE_SIZE);
			}
		},
		{ rootMargin: '240px' }
	);
	observer.observe(sentinelEl);
	return () => observer.disconnect();
});

// --- Filter mutation -------------------------------------------------------
const setFieldFilter = (fieldKey: string, next: PowerSearchFilter | null) => {
	activeSavedViewId = null;
	const rest = filters.filter((f) => f.field !== fieldKey);
	filters = next ? [...rest, next] : rest;
};

const togglePreset = (filter: PowerSearchFilter) => {
	activeSavedViewId = null;
	filters = filters.some((f) => JSON.stringify(f) === JSON.stringify(filter))
		? filters.filter((f) => JSON.stringify(f) !== JSON.stringify(filter))
		: [...filters.filter((f) => f.field !== filter.field), filter];
};

const clearAll = () => {
	filters = [];
	query = '';
	activeSavedViewId = null;
};

// --- Many-of fields --------------------------------------------------------
/**
 * One pass over the clause list keyed by field, rather than a pair of hooks per
 * field, so adding a many-of field is a MULTI_FILTER_FIELDS entry and nothing
 * else. A saved view or a hand-typed power-search clause may have written a
 * single `is`, so a scalar reads back as a one-item list.
 */
const multiValues = $derived.by(() => {
	const byField: Record<string, string[]> = {};
	for (const field of MULTI_FILTER_FIELDS) {
		const active = filters.find((f) => f.field === field.key);
		const raw = active ? (active.value as { value?: unknown }).value : null;
		byField[field.key] = Array.isArray(raw)
			? raw.map(String)
			: raw == null
				? []
				: [String(raw)];
	}
	return byField;
});

const setMultiValues = (field: string, next: string[]) => {
	setFieldFilter(
		field,
		next.length === 0
			? null
			: {
					field,
					operator: 'is_any_of',
					value: { type: 'enum_list', value: next }
				}
	);
};

// --- Quote: range ----------------------------------------------------------
// Two bounds rather than one clause: power search has no numeric `between`,
// and applyFilters ANDs same-field clauses, so a pair reads as a range in both
// modes.
const boundValue = (operator: string, fallback: number) => {
	const found = filters.find((f) => f.field === 'quoted' && f.operator === operator);
	return found ? Number((found.value as { value: number }).value) : fallback;
};
const quoteLow = $derived(boundValue('greater_than_or_equal', QUOTE_MIN));
const quoteHigh = $derived(boundValue('less_than_or_equal', QUOTE_MAX));

// Dragging updates a draft; the committed filter waits for onChangeEnd so the
// table and its loading bar don't rerun on every pointer move.
let quoteDraft = $state<[number, number]>([QUOTE_MIN, QUOTE_MAX]);
$effect(() => {
	quoteDraft = [quoteLow, quoteHigh];
});

const commitQuote = (next: [number, number]) => {
	activeSavedViewId = null;
	const rest = filters.filter((f) => f.field !== 'quoted');
	const bounds: PowerSearchFilter[] = [];
	if (next[0] > QUOTE_MIN) {
		bounds.push({
			field: 'quoted',
			operator: 'greater_than_or_equal',
			value: { type: 'integer', value: next[0] }
		});
	}
	if (next[1] < QUOTE_MAX) {
		bounds.push({
			field: 'quoted',
			operator: 'less_than_or_equal',
			value: { type: 'integer', value: next[1] }
		});
	}
	filters = [...rest, ...bounds];
};

const hasQuoteFilter = $derived(quoteLow > QUOTE_MIN || quoteHigh < QUOTE_MAX);

/**
 * The clause the closed trigger reads as, matching the selectors beside it.
 * Undefined while the range is untouched, so ComplexSelector falls back to its
 * own placeholder and paints the unset treatment itself.
 */
const quoteLabel = $derived(
	!hasQuoteFilter
		? undefined
		: quoteLow > QUOTE_MIN && quoteHigh < QUOTE_MAX
			? `Quote ${formatMoney(quoteLow)} – ${formatMoney(quoteHigh)}`
			: quoteLow > QUOTE_MIN
				? `Quote over ${formatMoney(quoteLow)}`
				: `Quote under ${formatMoney(quoteHigh)}`
);

// --- Saved view actions ----------------------------------------------------
/**
 * A saved view is the whole screen, so applying one restores the view
 * configuration alongside the filters.
 *
 * Passing null is the All chip: it stands for no saved view, not for the
 * default configuration, so it drops the filters and leaves the columns,
 * density, sticky edges and grouping exactly as the reader has them.
 */
const applySavedView = (saved: SavedView | null) => {
	activeSavedViewId = saved?.id ?? null;
	filters = saved ? [...saved.filters] : [];
	// A saved view carries structured filters, which power search cannot show.
	// Leaving the query bar up would strand the reader on a mode that no longer
	// describes what the table is doing, so choosing a view wins.
	isPowerSearch = false;
	if (saved == null) {
		return;
	}
	view = { ...saved.view, columnKeys: [...saved.view.columnKeys] };
	// A collapsed key only means something under the field it came from, so
	// arriving on a different grouping opens every section again.
	collapsedGroups = new Set();
};

const createSavedView = (name: string) => {
	const trimmed = name.trim();
	if (!trimmed) {
		return;
	}
	const id = `saved-${Date.now()}`;
	savedViews = [
		...savedViews,
		{
			id,
			name: trimmed,
			filters: [...filters],
			view: { ...view, columnKeys: [...view.columnKeys] }
		}
	];
	activeSavedViewId = id;
	creatingName = null;
};

const saveEditedView = (edited: SavedView) => {
	savedViews = savedViews.map((s) => (s.id === edited.id ? { ...s, name: edited.name } : s));
	editing = null;
};

const deleteSavedView = (id: string) => {
	savedViews = savedViews.filter((s) => s.id !== id);
	activeSavedViewId = activeSavedViewId === id ? null : activeSavedViewId;
	editing = null;
};

/**
 * Every view control writes straight through to the live table: the panel has
 * no commit step, so what the reader sees behind the popover is always what
 * the controls say.
 *
 * With no Apply to hang it off, stepping off the active saved view moves here.
 * That makes the first toggle detach from the view rather than the last one.
 */
const updateView = (patch: (current: ViewState) => ViewState) => {
	const next = patch(view);
	// A collapsed key only means something under the field it came from, so
	// regrouping opens every section again.
	if (next.grouping !== view.grouping) {
		collapsedGroups = new Set();
	}
	view = next;
	activeSavedViewId = null;
};

// --- Table plugins ---------------------------------------------------------
const selectionState = useTableSelectionState<ServiceJob>(() => ({
	data: rows,
	idKey: 'id',
	selectedKeys,
	setSelectedKeys: (next) => (selectedKeys = next)
}));
const selectionPlugin = useTableSelection<ServiceJob>(() => ({
	...selectionState.selectionConfig,
	getRowLabel: (item: ServiceJob) => `${item.id} ${item.summary}`,
	// Row background already means "open in the panel" here, so checking a box
	// must not claim it too. The tick is the selection; aria-selected is still
	// set either way, so this costs assistive tech nothing.
	hasRowHighlight: false
}));
const sortablePlugin = useTableSortable<ServiceJob>(() => ({
	sort,
	onSortChange: (next) => (sort = next),
	allowUnsortedState: true,
	isMultiSortEnabled: true
}));

/**
 * A frozen column is dropped on a compact surface, whichever edge it is on.
 * Freezing trades scrollable width for a column that stays put, and that is a
 * good trade only while there is width left to scroll. Derived rather than
 * written back into the view: the setting is the reader's, and a phone should
 * not silently rewrite it or save it into their next saved view.
 */
const effectiveStickyStart = $derived<StickyEdge>(
	isCompactSurface.matches ? 'none' : view.stickyStart
);
const effectiveStickyEnd = $derived<StickyEdge>(
	isCompactSurface.matches ? 'none' : view.stickyEnd
);

// The checkbox column needs no mention here: the plugin pins the whole
// contiguous run from the first column through the last key it is given, so
// naming the first data column carries the selection column with it.
const stickyPlugin = useTableStickyColumns<ServiceJob>(() => ({
	startKeys: stickyKeys(effectiveStickyStart, view.columnKeys, false),
	endKeys: stickyKeys(effectiveStickyEnd, view.columnKeys, true)
}));

// --- Grouping --------------------------------------------------------------
const toggleGroup = (groupKey: string) => {
	const next = new Set(collapsedGroups);
	if (!next.delete(groupKey)) {
		next.add(groupKey);
	}
	collapsedGroups = next;
};

const groupBy = (item: ServiceJob) => groupKeyOf(item, groupField);
const getRowKey = (item: ServiceJob) => item.id;

const grouped = useTableGroupedRows<ServiceJob>(() => ({
	// The hook groups the loaded batch, and the batch always ends on a section
	// boundary, so every section it sees is entire. With grouping off it is
	// handed nothing, so it flattens nothing and its plugin goes unused.
	data: isGrouped ? rows : NO_ROWS,
	groupBy,
	collapsedGroups,
	onToggleGroup: toggleGroup,
	// No renderGroupHeader on purpose. The plugin only pins the heading to the
	// start edge for its built-in one; a custom heading is left full width.
	getRowKey,
	groupOrder: GROUP_ORDERS[groupField]
}));

const groupedRows = $derived(grouped.data);
const groupRowKey = grouped.idKey;

/**
 * A section header is a synthetic row, and the table renders every column's
 * cell against it before the plugin can discard them. Its fields read as `''`
 * there, which a cell that prints the value survives — but not the commoner
 * lookup: `STATUS_META['']` is undefined. Upstream wraps `renderCell` in a
 * plugin; here each cell snippet returns nothing for a header row, which is
 * the same guard without a second snippet layer.
 */
const isGroupHeaderRow = (item: ServiceJob) => groupRowKey(item).startsWith(GROUP_ROW_KEY_PREFIX);

/**
 * Opens the detail panel for the clicked row. There is no first-class row
 * activation plugin, so this reaches the `<tr>` through transformBodyRow.
 */
const rowActivationPlugin = $derived<TablePlugin<ServiceJob>>({
	// The selection column ships at 36px, which centres its checkbox 6px from
	// the table edge. 48px lands it on the 16px content gutter that
	// LayoutContent gives every other first cell.
	transformColumns: (cols) =>
		cols.map((col, index) =>
			index === 0 && col.key === SELECTION_COLUMN_KEY
				? { ...col, width: pixel(SELECTION_COLUMN_WIDTH) }
				: col
		),
	transformBodyRow: (props, item) => {
		// A section header is not a row: it must never open the panel or take
		// the active highlight, and its own toggle owns the click.
		if (isGroupHeaderRow(item)) {
			return props;
		}
		const isActive = item.id === activeJobId;
		return {
			...props,
			htmlProps: {
				...props.htmlProps,
				class: [props.htmlProps.class, 'tf-row-clickable', isActive && 'tf-row-active']
					.filter(Boolean)
					.join(' '),
				tabindex: 0,
				'aria-current': isActive ? true : undefined,
				onclick: (event: MouseEvent) => {
					// Checkboxes and other cell controls own their own clicks.
					if (
						(event.target as HTMLElement).closest('input, button, a, select, textarea') !=
						null
					) {
						return;
					}
					activeJobId = item.id;
				},
				onkeydown: (event: KeyboardEvent) => {
					// Only when the row itself has focus, so a checkbox keeps Space.
					if (event.target !== event.currentTarget) {
						return;
					}
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						activeJobId = item.id;
					}
				}
			}
		};
	}
});

const plugins = $derived<Record<string, TablePlugin<ServiceJob>>>({
	selection: selectionPlugin,
	sortable: sortablePlugin,
	sticky: stickyPlugin,
	rowActivation: rowActivationPlugin,
	// Last in the record, so the header row's one full-width cell is the final
	// word on what a header renders. Left out entirely while grouping is off.
	...(isGrouped ? { grouped: grouped.plugin } : null)
});

// --- Columns ---------------------------------------------------------------
/**
 * Compact is a one-line row, so the Job cell drops its second line and every
 * text cell clamps rather than wrapping. `maxLines` carries its own hover
 * tooltip for whatever it cut off, which hand-rolled ellipsis would not.
 */
const isCompact = $derived(view.density === 'compact');
const cellLines = $derived(isCompact ? 1 : 0);
/**
 * Spacious buys the row enough height for a site photo, so the Job cell leads
 * with one. Wire the tile to your own image; the placeholder stands in for it
 * here so the row keeps the height the density promised either way.
 */
const isSpacious = $derived(view.density === 'spacious');

const allColumns = $derived<Record<string, TableColumn<ServiceJob>>>({
	summary: {
		key: 'summary',
		header: 'Job',
		width: proportional(2, { minWidth: 240 }),
		sortable: true,
		renderCell: summaryCell
	},
	customer: {
		key: 'customer',
		header: 'Customer',
		width: proportional(1, { minWidth: 180 }),
		sortable: true,
		renderCell: customerCell
	},
	technician: {
		key: 'technician',
		header: 'Technician',
		width: pixel(200),
		sortable: true,
		renderCell: technicianCell
	},
	status: {
		key: 'status',
		header: 'Status',
		width: pixel(150),
		sortable: true,
		renderCell: statusCell
	},
	priority: {
		key: 'priority',
		header: 'Priority',
		width: pixel(120),
		sortable: true,
		renderCell: priorityCell
	},
	scheduledAt: {
		key: 'scheduledAt',
		header: 'Scheduled',
		width: pixel(160),
		sortable: true,
		renderCell: scheduledCell
	},
	quoted: {
		key: 'quoted',
		header: 'Quote',
		width: pixel(110),
		align: 'end',
		sortable: true,
		renderCell: quotedCell
	},
	equipment: {
		key: 'equipment',
		header: 'Equipment',
		width: proportional(1, { minWidth: 200 }),
		renderCell: equipmentCell
	},
	address: {
		key: 'address',
		header: 'Address',
		width: proportional(1, { minWidth: 200 }),
		renderCell: addressCell
	}
});

const columns = $derived(view.columnKeys.map((key) => allColumns[key]).filter(Boolean));

const selectedCount = $derived(selectedKeys.size);
const selectedJobs = $derived(allJobs.filter((j) => selectedKeys.has(j.id)));
// The search box narrows the results like any other filter, so it counts
// towards offering Clear all — otherwise a search with no filters set leaves
// the reader with a narrowed table and no single way back.
const hasFilters = $derived(filters.length > 0 || query !== '');

// Hoisted so the accessible name and the tooltip can't drift apart as the mode
// flips.
const powerSearchLabel = $derived(
	isPowerSearch ? 'Switch to filter tokens' : 'Advanced search'
);

const activeJob = $derived(allJobs.find((j) => j.id === activeJobId) ?? null);
/** Other jobs at the same site, newest first — the panel's history list. */
const siteHistory = $derived(
	activeJob == null
		? []
		: allJobs
				.filter((j) => j.customer === activeJob.customer && j.id !== activeJob.id)
				.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
);

// ---------------------------------------------------------------------------
// Columns panel
// ---------------------------------------------------------------------------

/**
 * The reader's own order, which is what reordering acts on — so it is the
 * stored list, not a derived one.
 */
const displayedColumns = $derived(view.columnKeys);

const availableColumns = $derived(ALL_COLUMN_KEYS.filter((k) => !view.columnKeys.includes(k)));

const setReorderSession = (next: ColumnReorderSession | null) => {
	reorderSessionRef = next;
	reorderSession = next;
};

const commitColumnOrder = (nextKeys: readonly string[]) => {
	updateView((v) => ({ ...v, columnKeys: [...nextKeys] }));
};

const moveColumn = (key: string, requestedIndex: number) => {
	const from = displayedColumns.indexOf(key);
	const to = Math.max(0, Math.min(displayedColumns.length - 1, requestedIndex));
	if (from < 0 || to === from) {
		return false;
	}
	const nextKeys = [...displayedColumns];
	nextKeys.splice(from, 1);
	nextKeys.splice(to, 0, key);
	commitColumnOrder(nextKeys);
	return true;
};

/**
 * A click with no drag behind it picks the row up for the keyboard, and a
 * second one drops it. That gives the grip the same two-step a screen reader is
 * told about, without stranding a pointer user who clicked it by habit.
 */
const handleGripClick = (key: string) => {
	if (suppressGripClick) {
		suppressGripClick = false;
		return;
	}
	const index = displayedColumns.indexOf(key);
	if (reorderSessionRef?.key === key) {
		setReorderSession(null);
		announce(
			`${COLUMN_LABELS[key]} dropped at position ${index + 1} of ${displayedColumns.length}.`
		);
		return;
	}
	setReorderSession({
		key,
		mode: 'keyboard',
		originalKeys: [...displayedColumns],
		fromIndex: index,
		toIndex: index
	});
	announce(
		`${COLUMN_LABELS[key]} picked up, position ${index + 1} of ${displayedColumns.length}. Use the arrow keys to move it, Space or Enter to drop, or Escape to cancel.`
	);
};

const handleGripKeyDown = (event: KeyboardEvent, key: string) => {
	const session = reorderSessionRef;
	if (event.key === 'Escape' && session?.key === key) {
		// Escape is the popover's own close key, so a cancel has to end here or
		// the panel disappears out from under the row being put back.
		event.preventDefault();
		event.stopPropagation();
		// Only write if something actually moved: updateView steps off the
		// active saved view, and abandoning a pick-up has changed nothing.
		if (
			session.originalKeys.join() !== displayedColumns.join() &&
			displayedColumns.includes(key)
		) {
			commitColumnOrder(session.originalKeys);
		}
		setReorderSession(null);
		announce(`${COLUMN_LABELS[key]} move cancelled.`);
		return;
	}
	const index = displayedColumns.indexOf(key);
	const targets: Record<string, number> = {
		ArrowUp: index - 1,
		ArrowDown: index + 1,
		Home: 0,
		End: displayedColumns.length - 1
	};
	const target = targets[event.key];
	if (target == null) {
		return;
	}
	// Arrow keys move the row whether or not it has been picked up first: the
	// pick-up is what a screen reader is offered, not a gate on the shortcut.
	event.preventDefault();
	if (moveColumn(key, target)) {
		announce(
			`${COLUMN_LABELS[key]}, position ${Math.max(0, Math.min(displayedColumns.length - 1, target)) + 1} of ${displayedColumns.length}.`
		);
	}
};

const handleGripPointerDown = (event: PointerEvent, key: string) => {
	if (event.button !== 0 || columnRowRefs.get(key) == null) {
		return;
	}
	suppressGripClick = true;
	(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
	const index = displayedColumns.indexOf(key);
	setReorderSession({
		key,
		mode: 'pointer',
		originalKeys: [...displayedColumns],
		fromIndex: index,
		toIndex: index,
		pointerId: event.pointerId,
		pointerStartY: event.clientY,
		hasPointerMoved: false
	});
};

const handleGripPointerMove = (event: PointerEvent) => {
	const session = reorderSessionRef;
	if (session?.mode !== 'pointer' || session.pointerId !== event.pointerId) {
		return;
	}
	const travel = Math.abs(event.clientY - (session.pointerStartY ?? 0));
	if (session.hasPointerMoved !== true && travel < REORDER_DRAG_THRESHOLD) {
		return;
	}
	// The dragged row is still in the list at its old height, so the insertion
	// point is measured against the rows that would remain without it.
	const remaining = session.originalKeys.filter((k) => k !== session.key);
	let toIndex = remaining.length;
	for (let i = 0; i < remaining.length; i += 1) {
		const row = columnRowRefs.get(remaining[i]);
		if (row == null) {
			continue;
		}
		const bounds = row.getBoundingClientRect();
		if (event.clientY < bounds.top + bounds.height / 2) {
			toIndex = i;
			break;
		}
	}
	if (session.hasPointerMoved === true && session.toIndex === toIndex) {
		return;
	}
	setReorderSession({ ...session, hasPointerMoved: true, toIndex });
};

const handleGripPointerEnd = (event: PointerEvent, cancelled: boolean) => {
	const session = reorderSessionRef;
	if (session?.mode !== 'pointer' || session.pointerId !== event.pointerId) {
		return;
	}
	const target = event.currentTarget as HTMLElement;
	if (target.hasPointerCapture?.(event.pointerId)) {
		target.releasePointerCapture?.(event.pointerId);
	}
	setReorderSession(null);
	// A press that never travelled is a click, not a drag — let it through so
	// the grip still picks up for the keyboard.
	if (cancelled || session.hasPointerMoved !== true) {
		suppressGripClick = false;
		return;
	}
	// The click lands after this handler, so the flag has to outlive the turn.
	setTimeout(() => {
		suppressGripClick = false;
	}, 0);
	if (session.toIndex === session.fromIndex) {
		return;
	}
	const nextKeys = [...session.originalKeys];
	nextKeys.splice(session.fromIndex, 1);
	nextKeys.splice(session.toIndex, 0, session.key);
	commitColumnOrder(nextKeys);
	announce(
		`${COLUMN_LABELS[session.key]} dropped at position ${session.toIndex + 1} of ${session.originalKeys.length}.`
	);
};

/**
 * Which row the insertion rule hangs off, and on which side. Suppressed while
 * the drop would land where the row already is, so a drag that has gone
 * nowhere does not draw a line promising a move.
 */
const columnDropPlacement = $derived.by(() => {
	const session = reorderSession;
	if (
		session?.mode !== 'pointer' ||
		session.hasPointerMoved !== true ||
		session.toIndex === session.fromIndex
	) {
		return null;
	}
	const remaining = session.originalKeys.filter((k) => k !== session.key);
	const before = remaining[session.toIndex];
	if (before != null) {
		return { key: before, position: 'before' as const };
	}
	const after = remaining[remaining.length - 1];
	return after == null ? null : { key: after, position: 'after' as const };
});

// ---------------------------------------------------------------------------
// Filter bar entries
// ---------------------------------------------------------------------------

/** One clause as it appears in the row and in the folded panel. */
type FilterEntry =
	| { kind: 'preset'; preset: (typeof PRESET_FILTERS)[number] }
	| { kind: 'multi'; field: (typeof MULTI_FILTER_FIELDS)[number] }
	| { kind: 'single'; field: FilterField }
	| { kind: 'quote' };

const filterEntries = $derived<FilterEntry[]>([
	...PRESET_FILTERS.map((preset) => ({ kind: 'preset' as const, preset })),
	...MULTI_FILTER_FIELDS.map((field) => ({ kind: 'multi' as const, field })),
	...FILTER_FIELDS.map((field) => ({ kind: 'single' as const, field })),
	{ kind: 'quote' as const }
]);

let overflowOpen = $state(false);

/** Placeholder rows standing in for the batch being fetched. */
const SKELETON_ROWS = 5;

/**
 * Width of the injected selection column. Wide enough to land its checkbox on
 * the 16px content gutter LayoutContent gives every other first cell.
 */
const SELECTION_COLUMN_WIDTH = 48;

/** Cell padding per density, mirroring the table's own scale. */
const DENSITY_PADDING: Record<Density, number> = {
	compact: 8,
	balanced: 12,
	spacious: 16
};
/** Inline width for one skeleton cell, mirroring the column it stands under. */
function skeletonCellStyle(col: TableColumn<ServiceJob>, pad: number, isLast: boolean): string {
	const width = col.width;
	const edge = isLast
		? 'padding-inline-end: var(--container-padding-inline-end, 0px);'
		: '';
	return width?.type === 'pixel'
		? `flex-grow: 0; flex-shrink: 0; padding-inline: ${pad}px; width: ${width.value}px; ${edge}`
		: `flex-basis: 0; flex-grow: ${width?.value ?? 1}; min-width: ${width?.minWidth ?? 120}px; padding-inline: ${pad}px; ${edge}`;
}
</script>

<!-- =============================================================================
     Shared snippets
     ============================================================================= -->

{#snippet searchIcon()}
	<Icon icon={Search} size="sm" />
{/snippet}
{#snippet bookmarkIcon()}
	<Icon icon={Bookmark} size="sm" />
{/snippet}
{#snippet bookmarkFilledIcon()}
	<Bookmark size={16} fill="currentColor" />
{/snippet}
{#snippet slidersIcon()}
	<Icon icon={SlidersHorizontal} size="sm" />
{/snippet}
{#snippet slidersFilledIcon()}
	<SlidersHorizontal size={16} fill="currentColor" />
{/snippet}
{#snippet bookmarkPlusIcon()}
	<Icon icon={BookmarkPlus} size="sm" />
{/snippet}
{#snippet pencilIcon()}
	<Icon icon={Pencil} size="sm" />
{/snippet}
{#snippet chevronDownIcon()}
	<Icon icon={ChevronDown} size="sm" />
{/snippet}
{#snippet gripIcon()}
	<Icon icon={GripVertical} size="sm" />
{/snippet}
{#snippet xIcon()}
	<Icon icon={X} size="sm" />
{/snippet}
{#snippet plusIcon()}
	<Icon icon={Plus} size="sm" />
{/snippet}
{#snippet imageIcon()}
	<Icon icon={ImageIcon} size="sm" color="secondary" />
{/snippet}
{#snippet searchLargeIcon()}
	<Icon icon={Search} size="lg" />
{/snippet}

<!-- =============================================================================
     Table cells
     ============================================================================= -->

{#snippet summaryCell(item: ServiceJob)}
	{#if !isGroupHeaderRow(item)}
		{#if isCompact}
			<Text type="body" maxLines={1}>{item.summary}</Text>
		{:else}
			<HStack gap={3} vAlign="center">
				{#if isSpacious}
					<!-- AspectRatio derives its height from a definite width, which a
					     flex child does not have — hence the pinned box. -->
					<AspectRatio ratio={4 / 3} fit="center" class="tf-job-media">
						{@render imageIcon()}
					</AspectRatio>
				{/if}
				<VStack gap={0}>
					<Text type="body">{item.summary}</Text>
					<Text type="supporting" color="secondary">{item.id}</Text>
				</VStack>
			</HStack>
		{/if}
	{/if}
{/snippet}

{#snippet customerCell(item: ServiceJob)}
	{#if !isGroupHeaderRow(item)}
		<Text type="body" maxLines={cellLines}>{item.customer}</Text>
	{/if}
{/snippet}

{#snippet technicianCell(item: ServiceJob)}
	{#if !isGroupHeaderRow(item)}
		<HStack gap={2} vAlign="center">
			<Avatar name={item.technician} size="sm" />
			<Text type="body" maxLines={cellLines}>{item.technician}</Text>
		</HStack>
	{/if}
{/snippet}

{#snippet statusCell(item: ServiceJob)}
	{#if !isGroupHeaderRow(item)}
		{@const meta = STATUS_META[item.status]}
		<Badge variant={meta.badge} label={meta.label} />
	{/if}
{/snippet}

{#snippet priorityCell(item: ServiceJob)}
	{#if !isGroupHeaderRow(item)}
		{@const meta = PRIORITY_META[item.priority]}
		<HStack gap={2} vAlign="center">
			<StatusDot
				variant={meta.dot}
				label={meta.label}
				isPulsing={item.priority === 'urgent'}
			/>
			<Text type="body" maxLines={cellLines}>{meta.label}</Text>
		</HStack>
	{/if}
{/snippet}

{#snippet scheduledCell(item: ServiceJob)}
	{#if !isGroupHeaderRow(item)}
		<Text type="body" maxLines={cellLines}>{formatScheduled(item.scheduledAt)}</Text>
	{/if}
{/snippet}

{#snippet quotedCell(item: ServiceJob)}
	{#if !isGroupHeaderRow(item)}
		<Text type="body" maxLines={cellLines}>{formatMoney(item.quoted)}</Text>
	{/if}
{/snippet}

{#snippet equipmentCell(item: ServiceJob)}
	{#if !isGroupHeaderRow(item)}
		<Text type="body" maxLines={cellLines}>{item.equipment}</Text>
	{/if}
{/snippet}

{#snippet addressCell(item: ServiceJob)}
	{#if !isGroupHeaderRow(item)}
		<Text type="body" maxLines={cellLines}>{item.address}</Text>
	{/if}
{/snippet}

<!-- =============================================================================
     Filter bar controls
     ============================================================================= -->

{#snippet quoteSurface(
	range: [number, number],
	onChange: (value: [number, number]) => void,
	close: () => void
)}
	<VStack gap={4}>
		<VStack gap={0}>
			<Text type="label">Quote range</Text>
			<Text type="large" hasTabularNumbers>
				{formatMoney(range[0])} – {formatMoney(range[1])}
			</Text>
		</VStack>

		<VStack gap={1}>
			<Slider
				label="Quote range"
				isLabelHidden
				value={range}
				min={QUOTE_MIN}
				max={QUOTE_MAX}
				step={QUOTE_STEP}
				valueDisplay="none"
				formatValue={formatMoney}
				minStepsBetweenThumbs={1}
				width="100%"
				onChange={(next: [number, number]) => (quoteDraft = next)}
				onChangeEnd={onChange}
			/>
			<!-- The bounds are their own row rather than Slider `marks`: mark
			     labels are absolutely positioned and contribute no height, so they
			     hang into whatever follows the track. -->
			<HStack hAlign="between" vAlign="center">
				<Text type="supporting" color="secondary">{formatMoney(QUOTE_MIN)}</Text>
				<Text type="supporting" color="secondary">{formatMoney(QUOTE_MAX)}</Text>
			</HStack>
		</VStack>

		<Divider />

		<!-- ComplexSelector has no `hasClear`, so unlike the selectors beside it
		     the clear lives in the surface rather than in the trigger. -->
		<HStack gap={2} hAlign="between" vAlign="center">
			<Button
				label="Clear"
				variant="ghost"
				size="sm"
				isDisabled={!hasQuoteFilter}
				onclick={() => onChange([QUOTE_MIN, QUOTE_MAX])}
			/>
			<Button label="Done" variant="secondary" size="sm" onclick={close} />
		</HStack>
	</VStack>
{/snippet}

{#snippet filterControl(entry: FilterEntry)}
	{#if entry.kind === 'preset'}
		{@const preset = entry.preset}
		{@const isPressed = filters.some((f) => JSON.stringify(f) === JSON.stringify(preset.filter))}
		<!--
			ToggleButton is a ghost Button underneath, so unpressed it has no chrome
			at all; the border is what puts it in the same family as the unset
			selectors. Pressed, its own overlay supplies the fill.
		-->
		<ToggleButton
			label={preset.label}
			size="sm"
			{isPressed}
			class="tf-chrome {isPressed ? 'tf-label-value' : 'tf-label-empty tf-surface'}"
			onPressedChange={() => togglePreset(preset.filter)}
		/>
	{:else if entry.kind === 'multi'}
		{@const field = entry.field}
		{@const selected = multiValues[field.key] ?? []}
		<MultiSelector
			label={`${field.label} filter`}
			isLabelHidden
			placeholder={field.label}
			size="sm"
			hasClear
			triggerDisplay="labels"
			options={[...field.options]}
			value={selected}
			class={selected.length > 0 ? 'tf-fill' : undefined}
			onChange={(next: string[]) => setMultiValues(field.key, next)}
		/>
	{:else if entry.kind === 'single'}
		{@const field = entry.field}
		{@const active = filters.find((f) => f.field === field.key)}
		{@const value = active ? String((active.value as { value?: unknown }).value ?? '') : ''}
		{#snippet singleValue(option: SelectorOptionData)}
			{`${field.label} ${field.operatorLabel} ${option.label ?? option.value}`}
		{/snippet}
		<Selector
			label={`${field.label} filter`}
			isLabelHidden
			placeholder={field.label}
			size="sm"
			hasClear
			options={[...field.options]}
			value={value === '' ? null : value}
			renderValue={singleValue}
			class={active ? 'tf-fill' : undefined}
			onChange={(next: string | null) =>
				setFieldFilter(
					field.key,
					next == null || next === ''
						? null
						: {
								field: field.key,
								operator: field.operator,
								value:
									field.valueType === 'integer'
										? { type: 'integer', value: Number(next) }
										: { type: 'enum', value: next }
							}
				)}
		/>
	{:else}
		<!--
			Quote is a range, not a one-of-many pick, so it takes the shell built
			for custom selection surfaces: ComplexSelector owns the same field,
			trigger and popover anatomy the selectors beside it use, and the slider
			owns only its own content. `value` is the draft rather than the committed
			range — dragging has to move the track, and the filter array is not
			written until the thumb is released.
		-->
		<ComplexSelector
			label="Quote filter"
			isLabelHidden
			placeholder="Quote"
			triggerLabel={quoteLabel}
			size="sm"
			value={quoteDraft}
			onChange={commitQuote}
			class={hasQuoteFilter ? 'tf-fill' : undefined}
			children={quoteSurface}
		/>
	{/if}
{/snippet}

{#snippet overflowFilterControls(hidden: OverflowItem<FilterEntry>[])}
	{@const count = hidden.length}
	{@const label = `${count} more ${count === 1 ? 'filter' : 'filters'}`}
	{#snippet overflowTrigger()}
		<Button
			label={`+${count}`}
			tooltip={label}
			aria-label={label}
			variant="ghost"
			size="sm"
			class="tf-chrome tf-surface"
			onclick={isCompactSurface.matches ? () => (overflowOpen = true) : undefined}
		/>
	{/snippet}
	{#snippet overflowBody()}
		<!--
			Each control fills the panel rather than sizing to its own label the way
			it does on the row: a column of content-width triggers reads as a ragged
			edge, not a list.
		-->
		<VStack
			gap={2}
			padding={isCompactSurface.matches ? 4 : 0}
			paddingBlockStart={0}
		>
			{#each hidden as item (item.index)}
				<StackItem size="fill" class="tf-overflow-item">
					{@render filterControl(item.value)}
				</StackItem>
			{/each}
		</VStack>
	{/snippet}
	{#if isCompactSurface.matches}
		{@render overflowTrigger()}
		<!-- `hug` rather than a fixed budget: the folded set is however many
		     clauses did not fit, so the sheet is as tall as it needs to be
		     instead of holding a gap under three controls. -->
		<BottomSheet
			isOpen={overflowOpen}
			onOpenChange={(open) => (overflowOpen = open)}
			{label}
			height="hug"
		>
			{@render overflowBody()}
		</BottomSheet>
	{:else}
		<Popover placement="below" alignment="end" width={280} {label} content={overflowBody}>
			{@render overflowTrigger()}
		</Popover>
	{/if}
{/snippet}

<!-- =============================================================================
     Loading rows / summary list / saved-view forms
     ============================================================================= -->

{#snippet loadingRows(columns: TableColumn<ServiceJob>[], density: Density)}
	{@const pad = DENSITY_PADDING[density]}
	<VStack gap={0} role="status" aria-label="Loading more jobs" class="tf-skeleton-bleed">
		{#each Array.from({ length: SKELETON_ROWS }, (_, row) => row) as row (row)}
			<HStack gap={0} aria-hidden class="tf-skeleton-row" style={`padding-block: ${pad}px;`}>
				<VStack
					gap={0}
					vAlign="center"
					style={`flex-grow: 0; flex-shrink: 0; padding-inline: 0; width: ${SELECTION_COLUMN_WIDTH}px; padding-inline-start: var(--container-padding-inline-start, 0px);`}
				>
					<Skeleton width={16} height={16} radius={1} index={row} />
				</VStack>
				{#each columns as col, index (col.key)}
					<VStack gap={0} vAlign="center" style={skeletonCellStyle(col, pad, index === columns.length - 1)}>
						{#if col.key === 'summary' && density !== 'compact'}
							<!-- The Job cell runs to two lines everywhere but compact;
							     matching that keeps the placeholders on the same rhythm. -->
							<VStack gap={2}>
								<Skeleton height={14} index={row * 4 + index} />
								<Skeleton width="40%" height={11} index={row * 4 + index + 1} />
							</VStack>
						{:else}
							<Skeleton height={12} index={row * 4 + index} />
						{/if}
					</VStack>
				{/each}
			</HStack>
		{/each}
	</VStack>
{/snippet}

{#snippet viewSummaryList(view: ViewState, filters: readonly PowerSearchFilter[])}
	{@const density = DENSITY_OPTIONS.find((o) => o.value === view.density)}
	{@const grouping = GROUPING_OPTIONS.find((o) => o.value === view.grouping)}
	{@const stickyStart = STICKY_START_OPTIONS.find((o) => o.value === view.stickyStart)}
	{@const stickyEnd = STICKY_END_OPTIONS.find((o) => o.value === view.stickyEnd)}
	<MetadataList columns="single" label={{ position: 'start', width: 104 }}>
		<MetadataListItem label="Filters">
			{#if filters.length === 0}
				<Text type="body">None</Text>
			{:else}
				<HStack gap={1} wrap="wrap">
					{#each filters as f (`${f.field}-${f.operator}-${filterValueText(f)}`)}
						<Token
							label={filterTokenLabel(f)}
							description={`${f.field} ${f.operator} ${filterValueText(f)}`}
							size="sm"
							style="min-width: 0; max-width: 100%;"
						/>
					{/each}
				</HStack>
			{/if}
		</MetadataListItem>
		<MetadataListItem label="Columns">
			<Text type="body">{view.columnKeys.length} of {ALL_COLUMN_KEYS.length}</Text>
		</MetadataListItem>
		<MetadataListItem label="Density">
			<Text type="body">{density?.label ?? view.density}</Text>
		</MetadataListItem>
		<MetadataListItem label="Grouping">
			<Text type="body">{grouping?.label ?? view.grouping}</Text>
		</MetadataListItem>
		<MetadataListItem label="Frozen start">
			<Text type="body">{stickyStart?.label ?? view.stickyStart}</Text>
		</MetadataListItem>
		<MetadataListItem label="Frozen end">
			<Text type="body">{stickyEnd?.label ?? view.stickyEnd}</Text>
		</MetadataListItem>
	</MetadataList>
{/snippet}

{#snippet adaptiveSavedViewForm(
	title: string,
	subtitle: string,
	isOpen: boolean,
	onOpenChange: (open: boolean) => void,
	children: Snippet
)}
	{#snippet closeFormIcon()}
		<Icon icon={X} size="sm" />
	{/snippet}
	{#if isCompactSurface.matches}
		<!-- Both hosts get `purpose="form"`: the sheet will not swipe away, so a
		     name half-typed survives a stray touch, and the explicit close below
		     is not optional on a phone that has no Escape. -->
		<BottomSheet
			{isOpen}
			{onOpenChange}
			label={title}
			purpose="form"
			height="tall"
		>
			<Section variant="transparent" padding={4} style="padding-block-start: 0;">
				<VStack gap={4}>
					<HStack gap={2}>
						<StackItem size="fill">
							<VStack gap={1}>
								<Heading level={3}>{title}</Heading>
								<Text type="supporting" color="secondary">{subtitle}</Text>
							</VStack>
						</StackItem>
						<IconButton
							label={`Close ${title.toLowerCase()}`}
							variant="ghost"
							size="sm"
							icon={closeFormIcon}
							onclick={() => onOpenChange(false)}
						/>
					</HStack>
					{@render children()}
				</VStack>
			</Section>
		</BottomSheet>
	{:else}
		<Dialog {isOpen} {onOpenChange} purpose="form" width={400}>
			<DialogHeader
				{title}
				{subtitle}
				onOpenChange={onOpenChange}
				style="margin-inline-start: calc(-1 * var(--container-padding-inline-start, 0px)); margin-inline-end: calc(-1 * var(--container-padding-inline-end, 0px)); margin-block-start: calc(-1 * var(--container-padding-block-start, 0px));"
			/>
			<Section variant="transparent" padding={4}>
				<VStack gap={4}>
					{@render children()}
				</VStack>
			</Section>
		</Dialog>
	{/if}
{/snippet}

<!-- =============================================================================
     View options
     ============================================================================= -->

{#snippet viewPanelBody()}
	{#if viewSection === 'columns'}
		<VStack gap={0} minHeight={0} class="tf-transfer-root">
			<!-- No column preset here: a saved view stores the whole view
			     configuration, columns included, so a second preset picker scoped to
			     columns alone would be a rival source of truth. -->
			<VisuallyHidden id={`${columnPanelId}-reorder-hint`}>
				Press Space or Enter to pick up a column. Use the arrow keys to move it, Space or Enter
				to drop, or Escape to cancel.
			</VisuallyHidden>

			<HStack gap={0} minHeight={0} class="tf-transfer-panels">
				<VStack
					gap={0}
					role="group"
					aria-labelledby={`${columnPanelId}-displayed`}
					class="tf-transfer-panel"
				>
					<HStack
						gap={2}
						vAlign="center"
						hAlign="between"
						paddingBlock={2}
						class="tf-transfer-header tf-transfer-pad-start"
					>
						<Text id={`${columnPanelId}-displayed`} type="label" color="secondary">
							Displayed columns
						</Text>
						<Button
							label="Restore"
							variant="ghost"
							size="sm"
							class="tf-transfer-header-action"
							onclick={() => updateView((v) => ({ ...v, columnKeys: DEFAULT_COLUMN_KEYS }))}
						/>
					</HStack>
					<VStack gap={0} class="tf-transfer-body">
						{#if displayedColumns.length === 0}
							<VStack
								gap={0}
								vAlign="center"
								hAlign="center"
								minHeight="100%"
								paddingBlock={4}
								class="tf-transfer-empty tf-transfer-pad-start"
							>
								<Text type="supporting" color="secondary">No columns are displayed.</Text>
							</VStack>
						{:else}
							{#snippet displayedHeader()}
								<VisuallyHidden>Displayed columns</VisuallyHidden>
							{/snippet}
							<List density="compact" header={displayedHeader}>
								{#each displayedColumns as key (key)}
									{@const isLocked = key === LOCKED_COLUMN_KEY}
									{@const isPicked =
										reorderSession?.key === key && reorderSession.mode === 'keyboard'}
									{@const isDragging =
										reorderSession?.key === key &&
										reorderSession.mode === 'pointer' &&
										reorderSession.hasPointerMoved === true}
									{@const drop =
										columnDropPlacement?.key === key ? columnDropPlacement.position : null}
									{#snippet columnGrip()}
										<IconButton
											label={`Reorder ${COLUMN_LABELS[key]}`}
											aria-describedby={`${columnPanelId}-reorder-hint`}
											aria-pressed={isPicked}
											variant="ghost"
											size="sm"
											icon={gripIcon}
											class="tf-transfer-grip tf-reorder-handle{isPicked || isDragging
												? ' tf-reorder-handle-active'
												: ''}"
											onclick={() => handleGripClick(key)}
											onkeydown={(event) => handleGripKeyDown(event, key)}
											onpointerdown={(event) => handleGripPointerDown(event, key)}
											onpointermove={handleGripPointerMove}
											onpointerup={(event) => handleGripPointerEnd(event, false)}
											onpointercancel={(event) => handleGripPointerEnd(event, true)}
											onlostpointercapture={(event) => handleGripPointerEnd(event, true)}
										/>
									{/snippet}
									{#snippet columnRemove()}
										<!-- A control that refuses without saying why is a dead
										     end; the tooltip is the explanation. -->
										<IconButton
											label={`Remove ${COLUMN_LABELS[key]}`}
											variant="ghost"
											size="sm"
											isDisabled={isLocked}
											tooltip={isLocked ? LOCKED_COLUMN_MESSAGE : undefined}
											icon={xIcon}
											class="tf-transfer-end-action"
											onclick={() =>
												updateView((v) => ({
													...v,
													columnKeys: v.columnKeys.filter((k) => k !== key)
												}))}
										/>
									{/snippet}
									<Item
										as="li"
										density="compact"
										label={COLUMN_LABELS[key]}
										startContent={columnGrip}
										endContent={columnRemove}
										class="tf-transfer-item tf-transfer-pad-start{isPicked
											? ' tf-transfer-picked'
											: ''}{isDragging ? ' tf-reorder-source' : ''}{drop === 'before'
											? ' tf-reorder-before'
											: ''}{drop === 'after' ? ' tf-reorder-after' : ''}"
										{@attach (node) => {
											columnRowRefs.set(key, node as HTMLElement);
											return () => columnRowRefs.delete(key);
										}}
									/>
								{/each}
							</List>
						{/if}
					</VStack>
				</VStack>

				<VStack
					gap={0}
					role="group"
					aria-labelledby={`${columnPanelId}-available`}
					class="tf-transfer-panel tf-transfer-divider"
				>
					<HStack
						gap={2}
						vAlign="center"
						hAlign="between"
						paddingBlock={2}
						class="tf-transfer-header tf-transfer-pad-end"
					>
						<Text id={`${columnPanelId}-available`} type="label" color="secondary">
							Available columns
						</Text>
						<Button
							label="Select all"
							variant="ghost"
							size="sm"
							class="tf-transfer-header-action"
							isDisabled={view.columnKeys.length === ALL_COLUMN_KEYS.length}
							onclick={() =>
								updateView((v) => ({
									...v,
									// Appended, not re-sorted: a bulk add is still an add, and it
									// has no business restating the reader's order.
									columnKeys: [
										...v.columnKeys,
										...ALL_COLUMN_KEYS.filter((k) => !v.columnKeys.includes(k))
									]
								}))}
						/>
					</HStack>
					<VStack gap={0} class="tf-transfer-body">
						{#if availableColumns.length === 0}
							<VStack
								gap={0}
								vAlign="center"
								hAlign="center"
								minHeight="100%"
								paddingBlock={4}
								class="tf-transfer-empty tf-transfer-pad-end"
							>
								<Text type="supporting" color="secondary">All columns are displayed.</Text>
							</VStack>
						{:else}
							{#snippet availableHeader()}
								<VisuallyHidden>Available columns</VisuallyHidden>
							{/snippet}
							<List density="compact" header={availableHeader}>
								{#each availableColumns as key (key)}
									{#snippet addColumn()}
										<IconButton
											label={`Add ${COLUMN_LABELS[key]}`}
											variant="ghost"
											size="sm"
											icon={plusIcon}
											class="tf-transfer-end-action"
											onclick={() =>
												updateView((v) => ({
													...v,
													// Appended rather than slotted back into canonical order:
													// the reader's own ordering is the thing being edited.
													columnKeys: [...v.columnKeys, key]
												}))}
										/>
									{/snippet}
									<Item
										as="li"
										density="compact"
										label={COLUMN_LABELS[key]}
										endContent={addColumn}
										class="tf-transfer-item tf-transfer-pad-end"
									/>
								{/each}
							</List>
						{/if}
					</VStack>
				</VStack>
			</HStack>
		</VStack>
	{:else if viewSection === 'density'}
		<VStack gap={0} paddingInline={4} paddingBlockEnd={4}>
			<RadioList
				label="Density"
				isLabelHidden
				value={view.density}
				onChange={(value: string) =>
					updateView((v) => ({ ...v, density: value as Density }))}
			>
				{#each DENSITY_OPTIONS as option (option.value)}
					<RadioListItem value={option.value} label={option.label} />
				{/each}
			</RadioList>
		</VStack>
	{:else if viewSection === 'sticky'}
		<VStack gap={4} paddingInline={4} paddingBlockEnd={4}>
			<!-- Both groups read the effective value, not the stored one, and go
			     disabled where the two differ — a radio still sitting on "First
			     column" while nothing is frozen is the control lying about the table. -->
			<RadioList
				label="First columns"
				value={effectiveStickyStart}
				isDisabled={isCompactSurface.matches}
				disabledMessage="Freezing is off on a narrow screen: a pinned column would leave too little width to scroll the rest."
				onChange={(value: string) =>
					updateView((v) => ({ ...v, stickyStart: value as StickyEdge }))}
			>
				{#each STICKY_START_OPTIONS as option (option.value)}
					<RadioListItem value={option.value} label={option.label} />
				{/each}
			</RadioList>
			<RadioList
				label="Last columns"
				value={effectiveStickyEnd}
				isDisabled={isCompactSurface.matches}
				disabledMessage="Freezing is off on a narrow screen: a pinned column would leave too little width to scroll the rest."
				onChange={(value: string) =>
					updateView((v) => ({ ...v, stickyEnd: value as StickyEdge }))}
			>
				{#each STICKY_END_OPTIONS as option (option.value)}
					<RadioListItem value={option.value} label={option.label} />
				{/each}
			</RadioList>
		</VStack>
	{:else}
		<VStack gap={0} paddingInline={4} paddingBlockEnd={4}>
			<RadioList
				label="Grouping"
				isLabelHidden
				value={view.grouping}
				onChange={(value: string) =>
					updateView((v) => ({ ...v, grouping: value as GroupField }))}
			>
				{#each GROUPING_OPTIONS as option (option.value)}
					<RadioListItem value={option.value} label={option.label} />
				{/each}
			</RadioList>
		</VStack>
	{/if}
{/snippet}

{#snippet viewOptionsTrigger()}
	<!--
		Flat rather than outlined: ghost is the borderless variant Button and
		Selector share, so this trigger reads as the same family of control as a
		ghost Selector — chevron and all — without the local filter chrome the
		bordered toggles in the row need.
	-->
	<Button
		label="View options"
		variant="ghost"
		size="sm"
		endContent={chevronDownIcon}
		onclick={isCompactSurface.matches ? () => (isViewOpen = true) : undefined}
	/>
{/snippet}

{#snippet viewOptionsPopover()}
	{@const activeSectionTitle = VIEW_SECTIONS.find((s) => s.key === viewSection)?.title}
	<VStack gap={0}>
		<HStack gap={0} class="tf-view-popover">
			<Section
				variant="transparent"
				padding={1}
				dividers={['end']}
				class="tf-view-rail"
			>
				<VStack gap={1}>
					{#each VIEW_SECTIONS as section (section.key)}
						{#snippet sectionIcon()}
							<Icon icon={section.icon} size="sm" />
						{/snippet}
						<Button
							label={section.label}
							variant={viewSection === section.key ? 'secondary' : 'ghost'}
							icon={sectionIcon}
							class="tf-rail-item"
							onclick={() => (viewSection = section.key)}
						/>
					{/each}
				</VStack>
			</Section>

			<StackItem size="fill">
				<!-- A stack rather than a Section: the pane carries no gutter of its
				     own, so a child can run a rule the full width of it. -->
				<VStack gap={0} minHeight={0} class="tf-view-panel">
					<!-- The pane's gutter, restated here because the container carries
					     none — that is what lets a rule below reach both edges. -->
					<VStack gap={0} padding={4} paddingBlockEnd={3}>
						<Heading level={3}>{activeSectionTitle}</Heading>
					</VStack>

					{@render viewPanelBody()}
				</VStack>
			</StackItem>
		</HStack>
	</VStack>
{/snippet}

{#snippet viewOptionsSheet()}
	<!--
		The same four sections on a phone, where the popover's shape is what
		fails: 660px of rail-beside-pane squeezed into 393px leaves the column
		lists about 75px each. The rail turns horizontal and becomes a TabList,
		which already owns this; below it the pane gets the full width.
	-->
	<BottomSheet
		isOpen={isCompactSurface.matches && isViewOpen}
		onOpenChange={(open) => (isViewOpen = open)}
		label="View options"
		height="tall"
	>
		<VStack gap={0}>
			<TabList
				value={viewSection}
				onChange={(value: string) => (viewSection = value as ViewSection)}
				role="tablist"
				hasDivider
				class="tf-view-sheet-tabs"
			>
				{#each VIEW_SECTIONS as section (section.key)}
					{#snippet tabIcon()}
						<Icon icon={section.icon} size="sm" />
					{/snippet}
					<Tab
						id={`${viewPanelId}-tab-${section.key}`}
						value={section.key}
						label={section.label}
						icon={tabIcon}
						panelId={viewPanelId}
					/>
				{/each}
			</TabList>

			<!-- The panels set their own inline gutter and bottom padding but no top
			     one, because in the popover the dropped heading was the thing
			     separating them from what is above. Here the strip's rule takes that
			     place, so the gap it left is restated at the same 12px. -->
			<VStack
				gap={0}
				id={viewPanelId}
				role="tabpanel"
				aria-labelledby={`${viewPanelId}-tab-${viewSection}`}
				paddingBlockStart={3}
			>
				{@render viewPanelBody()}
			</VStack>
		</VStack>
	</BottomSheet>
{/snippet}

<!-- =============================================================================
     Detail panel
     ============================================================================= -->

{#snippet detailBody()}
	{#if activeJob != null}
		{@const job = activeJob}
		<VStack gap={0} class="tf-detail-panel">
			<!-- The only part of the body that knows which host it is in: in the
			     sheet, the sheet's band under its grab bar is the top inset; the
			     docked panel has no pill and keeps the 16px gutter. -->
			<Section
				variant="transparent"
				padding={4}
				style={`padding-block-start: ${isCompactSurface.matches ? 0 : 4 * 4}px;`}
			>
				<VStack gap={4}>
					<HStack gap={2}>
						<StackItem size="fill">
							<VStack gap={2}>
								<HStack gap={2} vAlign="center">
									<Badge
										variant={STATUS_META[job.status].badge}
										label={STATUS_META[job.status].label}
									/>
									<StatusDot
										variant={PRIORITY_META[job.priority].dot}
										label={`${PRIORITY_META[job.priority].label} priority`}
										isPulsing={job.priority === 'urgent'}
									/>
									<Text type="supporting" color="secondary">
										{PRIORITY_META[job.priority].label} · {job.id}
									</Text>
								</HStack>
								<Heading level={2}>{job.summary}</Heading>
							</VStack>
						</StackItem>
						<IconButton
							label="Close details"
							variant="ghost"
							size="sm"
							icon={xIcon}
							onclick={() => (activeJobId = null)}
						/>
					</HStack>

					<!-- Both take the full width, so flex shrink splits the row evenly
					     however wide the panel is dragged. -->
					<HStack gap={2}>
						<Button label={NEXT_ACTION[job.status]} size="sm" width="100%" />
						<Button label="Edit job" variant="secondary" size="sm" width="100%" />
					</HStack>
				</VStack>
			</Section>

			<Divider />

			<Section variant="transparent" padding={4}>
				<MetadataList columns="single" label={{ position: 'start', width: 104 }}>
					<MetadataListItem label="Customer">
						<Text type="body">{job.customer}</Text>
					</MetadataListItem>
					<MetadataListItem label="Site address">
						<Text type="body">{job.address}</Text>
					</MetadataListItem>
					<MetadataListItem label="Technician">
						<Text type="body">{job.technician}</Text>
					</MetadataListItem>
					<MetadataListItem label="Scheduled">
						<Text type="body">
							{formatDate(job.scheduledAt, true)}, {formatTime(job.scheduledAt)}
						</Text>
					</MetadataListItem>
					<MetadataListItem label="Equipment">
						<Text type="body">{job.equipment}</Text>
					</MetadataListItem>
					<MetadataListItem label="Quote">
						<Text type="body">{formatMoney(job.quoted)}</Text>
					</MetadataListItem>
				</MetadataList>
			</Section>

			<Divider />

			<Section variant="transparent" padding={4}>
				<VStack gap={2}>
					<Heading level={3}>Site history</Heading>
					{#if siteHistory.length === 0}
						<Text type="supporting" color="secondary">
							No other visits on file for this site.
						</Text>
					{:else}
						<VStack gap={0}>
							{#each siteHistory as related (related.id)}
								{#snippet relatedStatus()}
									<Badge
										variant={STATUS_META[related.status].badge}
										label={STATUS_META[related.status].label}
									/>
								{/snippet}
								<Item
									align="center"
									label={related.summary}
									labelLines={2}
									description={`${formatDate(related.scheduledAt, true)} · ${related.technician}`}
									endContent={relatedStatus}
									onclick={() => (activeJobId = related.id)}
								/>
							{/each}
						</VStack>
					{/if}
				</VStack>
			</Section>
		</VStack>
	{/if}
{/snippet}

{#snippet detailPanel()}
	{#if activeJob != null}
		<!-- The panel owns the separator, so the handle stays divider-less and
		     hides its pill at rest rather than floating a stray stub. -->
		<ResizeHandle
			resizable={detailWidth.props}
			isReversed
			isAlwaysVisible={false}
			label="Resize job details"
		/>
		<!-- Panel padding is 0 so the dividers reach both edges; each section
		     inside re-adds the 16px gutter to keep its content on the same line. -->
		<LayoutPanel resizable={detailWidth.props} hasDivider padding={0} label="Job details">
			{@render detailBody()}
		</LayoutPanel>
	{/if}
{/snippet}

{#snippet detailSheet()}
	<!-- `tall` because this is the reading surface, not a picker. -->
	<BottomSheet
		isOpen={isCompactSurface.matches && activeJob != null}
		onOpenChange={(open) => !open && (activeJobId = null)}
		label="Job details"
		height="tall"
	>
		{@render detailBody()}
	</BottomSheet>
{/snippet}

<!-- =============================================================================
     Filter row, saved views and bulk bar
     ============================================================================= -->

{#snippet powerSearchToggle()}
	<!-- `tooltip` is stated rather than left to isIconOnly: the automatic tooltip
	     the prop documents never reaches Button. -->
	<ToggleButton
		label={powerSearchLabel}
		tooltip={powerSearchLabel}
		isIconOnly
		size="sm"
		isPressed={isPowerSearch}
		icon={slidersIcon}
		pressedIcon={slidersFilledIcon}
		onPressedChange={(next) => (isPowerSearch = next)}
	/>
{/snippet}

{#snippet filterBar()}
	<HStack gap={2} vAlign="center" wrap="nowrap" minHeight={32} class="tf-filter-row">
		<!-- Search leads the row: it is the broadest filter, and anchoring it at
		     the start keeps a fixed-width control on the first line. It sits
		     outside the overflow list so it is never the clause that collapses. -->
		<StackItem class="tf-search-slot">
			<TextInput
				label="Search jobs"
				isLabelHidden
				placeholder="Job name"
				size="sm"
				width="100%"
				value={query}
				onChange={(next: string) => (query = next)}
				startIcon={searchIcon}
			/>
		</StackItem>

		<!--
			The slot, not the list, is what carries the sizing. A list that reads its
			own width is reading the thing it just changed, so `observeParent` sends
			it up here instead. The readout lives in here with the list for the same
			reason, so sizing this wrapper from the row does not drag the readout out
			to the row's edge with it.
		-->
		<StackItem class="tf-filter-slot">
			<!-- One clause stays on the row where there is width for it; a phone
			     has no such width, so the floor comes off there. -->
			<OverflowList
				items={filterEntries}
				item={filterControl}
				gap={2}
				behavior="observeParent"
				minVisibleItems={isCompactSurface.matches ? 0 : 1}
				overflowRenderer={overflowFilterControls}
			/>

			<HStack gap={2} vAlign="center" class="tf-filter-meta">
				{@render powerSearchToggle()}

				<Text type="supporting" color="secondary">
					{results.length}
					{results.length === 1 ? 'result' : 'results'}
				</Text>

				{#if hasFilters}
					<Text type="supporting" color="secondary">•</Text>
					<!-- Href-less, so Link renders a button: this resets the filter
					     array, it does not navigate. -->
					<Link type="supporting" onclick={clearAll}>Clear all</Link>
				{/if}
			</HStack>
		</StackItem>
	</HStack>
{/snippet}

{#snippet savedViewsBar()}
	<HStack gap={2} vAlign="center" wrap="nowrap" minHeight={32} class="tf-bar">
		<!-- Outside the scroller, so the row keeps saying what it is however far
		     the chips are pushed along. -->
		<Text type="label" class="tf-saved-views-label">Saved views:</Text>
		<!--
			Same slot-and-content split the filter row uses: the slot is the piece
			that shrinks, and the scroller inside reads the width it is left with.
			Scrolled rather than folded into a count, unlike the clauses — a saved
			view is picked by recognising its name.
		-->
		<StackItem class="tf-saved-views-slot">
			<HStack gap={2} vAlign="center" wrap="nowrap" class="tf-saved-views-scroller">
				<!-- Exactly one of these is engaged at a time, so All is a member of
				     the same group rather than a differently-shaped reset button. -->
				<ToggleButton
					label="All"
					size="sm"
					isPressed={activeSavedViewId == null}
					class="tf-saved-view-chip tf-chrome {activeSavedViewId == null
						? 'tf-label-value'
						: 'tf-label-empty'}{activeSavedViewId != null ? ' tf-surface' : ''}"
					onPressedChange={() => applySavedView(null)}
				/>
				{#each savedViews as saved (saved.id)}
					{@const isPressed = activeSavedViewId === saved.id}
					<!-- Unpressing lands on the state the All chip already models:
					     applySavedView(null) drops the active id and its filters
					     together, so the two controls can never disagree. -->
					<ToggleButton
						label={saved.name}
						size="sm"
						{isPressed}
						icon={bookmarkIcon}
						class="tf-saved-view-chip tf-chrome {isPressed
							? 'tf-label-value'
							: 'tf-label-empty'}{!isPressed ? ' tf-surface' : ''}"
						onPressedChange={(next) => applySavedView(next ? saved : null)}
					/>
				{/each}
				{#if activeSavedViewId != null}
					<IconButton
						label="Edit saved view"
						tooltip="Edit saved view"
						variant="ghost"
						size="sm"
						icon={pencilIcon}
						class="tf-saved-view-chip"
						onclick={() => {
							const found = savedViews.find((s) => s.id === activeSavedViewId);
							if (found) {
								editing = { ...found };
							}
						}}
					/>
				{/if}
			</HStack>
		</StackItem>
	</HStack>
{/snippet}

{#snippet bulkBar()}
	<Section variant="muted" padding={3} paddingBlock={1.5} class="tf-bulk-band">
		<HStack gap={3} vAlign="center" wrap="wrap" minHeight={32} class="tf-bar">
			<StackItem size="fill">
				<HStack gap={1} vAlign="center">
					{#each BULK_EDIT_ACTIONS as action (action.key)}
						{#snippet bulkIcon()}
							<Icon icon={action.icon} size="sm" />
						{/snippet}
						<Button
							label={action.label}
							variant="ghost"
							size="sm"
							icon={bulkIcon}
							onclick={() => action.onClick(selectedJobs)}
						/>
					{/each}
				</HStack>
			</StackItem>

			<!-- Grouped so the separator can't strand itself on a line of its own
			     once the actions grow wide enough to break the bar. -->
			<HStack gap={3} vAlign="center">
				<Text type="body">
					{selectedCount}
					{selectedCount === 1 ? 'job' : 'jobs'} selected
				</Text>
				<Text type="supporting" color="secondary">•</Text>
				<Button
					label="Unselect All"
					variant="ghost"
					size="sm"
					onclick={() => (selectedKeys = new Set())}
				/>
			</HStack>
		</HStack>
	</Section>
{/snippet}

<!-- =============================================================================
     Saved-view form bodies
     ============================================================================= -->

{#snippet createFormChildren()}
	<TextInput
		label="Name"
		value={creatingName ?? ''}
		onChange={(value: string) => (creatingName = value)}
		hasAutoFocus
	/>
	<VStack gap={1}>
		<Text type="label">This view saves</Text>
		{@render viewSummaryList(view, filters)}
	</VStack>
	<HStack hAlign="end">
		<Button
			label="Create"
			variant="primary"
			isDisabled={(creatingName ?? '').trim() === ''}
			onclick={() => createSavedView(creatingName ?? '')}
		/>
	</HStack>
{/snippet}

{#snippet editFormChildren()}
	<TextInput
		label="Name"
		value={editing?.name ?? ''}
		onChange={(value: string) => {
			if (editing) {
				editing = { ...editing, name: value };
			}
		}}
	/>
	<!-- The configuration is captured, not editable here: it is changed by
	     reconfiguring the table and saving a new view. -->
	<VStack gap={1}>
		<Text type="label">This view saves</Text>
		{#if editing == null}
			<Text type="supporting" color="secondary">(Empty)</Text>
		{:else}
			{@render viewSummaryList(editing.view, editing.filters)}
		{/if}
	</VStack>
	<HStack gap={2} vAlign="center">
		<Button
			label="Delete"
			variant="destructive"
			onclick={() => {
				if (editing) {
					deleteSavedView(editing.id);
				}
			}}
		/>
		<StackItem size="fill">
			<HStack hAlign="end">
				<Button
					label="Save"
					variant="primary"
					onclick={() => {
						if (editing) {
							saveEditedView(editing);
						}
					}}
				/>
			</HStack>
		</StackItem>
	</HStack>
{/snippet}

<!-- =============================================================================
     Page
     ============================================================================= -->

{#snippet pageHeader()}
	<LayoutHeader hasDivider label="Job filters and table actions">
		<VStack gap={0} class="tf-header-wrap">
			{#if isLoading}
				<ProgressBar
					label="Loading jobs"
					isLabelHidden
					isIndeterminate
					class="tf-progress"
				/>
			{/if}

			<Section variant="transparent" padding={4} class="tf-toolbar-container">
				<VStack gap={4}>
					<!-- No page-title component publishes an end slot, so the title
					     and its action are a row, the same shape the other table
					     templates use. -->
					<HStack gap={3} vAlign="center">
						<StackItem size="fill">
							<Heading level={1}>Service jobs</Heading>
						</StackItem>
						<Button label="New job" variant="primary" onclick={() => alert('New job')} />
					</HStack>

					{#if selectedCount > 0}
						{@render bulkBar()}
					{:else}
						<HStack gap={3} vAlign="center" wrap="wrap">
							<StackItem size="fill" class="tf-toolbar-primary">
								{#if isPowerSearch}
									<PowerSearch
										config={powerSearch.config}
										{filters}
										onChange={(next: readonly PowerSearchFilter[]) => (filters = [...next])}
										placeholder='Try "quote > 1000" or "status is Overdue"'
										resultCount={results.length}
									/>
								{:else if isSavedViewsBarOpen}
									{@render savedViewsBar()}
								{:else}
									{@render filterBar()}
								{/if}
							</StackItem>

							<!-- One flex item rather than loose siblings: at narrow widths
							     the whole cluster has to drop below the filter row together. -->
							<HStack gap={3} vAlign="center" class="tf-toolbar-end">
								<!-- Saved views mode is about picking a view, so the controls
								     that edit one step aside. Only the toggle that got you here
								     stays, which is also the way back. -->
								{#if !isSavedViewsBarOpen}
									<!-- Only while power search is up: the query bar has no
									     filter row to carry the toggle, so this is the return
									     trip. Leads the cluster so it stays the leftmost control
									     in both modes. -->
									{#if isPowerSearch}
										{@render powerSearchToggle()}
									{/if}

									<!-- Same trigger either way; only what it opens changes. On a
									     phone the panel is the sheet rendered beside the dialogs,
									     so the button drives `isViewOpen` directly. -->
									{#if isCompactSurface.matches}
										{@render viewOptionsTrigger()}
									{:else}
										<Popover
											placement="below"
											alignment="end"
											width={660}
											label="View options"
											isOpen={isViewOpen}
											onOpenChange={(open) => (isViewOpen = open)}
											content={viewOptionsPopover}
										>
											{@render viewOptionsTrigger()}
										</Popover>
									{/if}

									<IconButton
										label="Create saved view"
										tooltip="Create saved view"
										variant="ghost"
										size="sm"
										icon={bookmarkPlusIcon}
										onclick={() => (creatingName = '')}
									/>
								{/if}

								<ToggleButton
									label="Saved views"
									tooltip="Saved views"
									isIconOnly
									size="sm"
									isPressed={isSavedViewsBarOpen}
									icon={bookmarkIcon}
									pressedIcon={bookmarkFilledIcon}
									onPressedChange={(next) => {
										isSavedViewsBarOpen = next;
										// Power search wins the render below, so opening the bar
										// from that mode would toggle a control that changes
										// nothing on screen. Asking for saved views is a decision
										// to leave the query bar.
										if (next) {
											isPowerSearch = false;
										}
									}}
								/>
							</HStack>
						</HStack>
					{/if}
				</VStack>
			</Section>
		</VStack>
	</LayoutHeader>
{/snippet}

{#snippet emptyStateActions()}
	<Button label="Clear all" onclick={clearAll} />
	<Button label="Power search" variant="secondary" onclick={() => (isPowerSearch = true)} />
{/snippet}

{#snippet pageContent()}
	<!-- Default padding (16px) is deliberate: Table bleeds to the edges and
	     re-applies it to the first and last cells. -->
	<LayoutContent padding={4} label="Service jobs">
		{#if results.length === 0}
			<EmptyState
				icon={searchLargeIcon}
				title="No jobs match these filters"
				description="Try clearing a filter, or switch to power search to build a broader query."
				actions={emptyStateActions}
			/>
		{:else}
			<!-- Rows are two lines in the Job column at every density but compact;
			     top alignment keeps the checkbox and every other cell on the first
			     content line. -->
			<Table
				data={isGrouped ? groupedRows : rows}
				{columns}
				idKey={isGrouped ? groupRowKey : 'id'}
				density={view.density}
				dividers="rows"
				hasHover
				textOverflow="wrap"
				verticalAlign="top"
				plugins={plugins}
				rowCount={results.length}
			/>
		{/if}

		{#if results.length > 0}
			{#if hasNext}
				<!-- Tall enough that the observer trips before the reader reaches the
				     true end of the list. -->
				<VStack
					gap={0}
					minHeight={56}
					{@attach (node) => {
						sentinelEl = node as HTMLElement;
					}}
				>
					{#if isLoadingNext}
						{@render loadingRows(columns, view.density)}
					{/if}
				</VStack>
			{:else if results.length > PAGE_SIZE}
				<VStack gap={0} minHeight={56} vAlign="center" hAlign="center">
					<Text type="supporting" color="secondary">
						All {results.length} jobs loaded
					</Text>
				</VStack>
			{/if}
		{/if}
	</LayoutContent>
{/snippet}

<Layout
	height="fill"
	padding={0}
	class="tf-page-shell"
	end={isCompactSurface.matches ? undefined : detailPanel}
	header={pageHeader}
	content={pageContent}
/>

<!-- Mounted at every width rather than behind the branch: a closed BottomSheet
     is one hidden dialog element, and gating the mount would tear the panel down
     under a reader who rotates the phone mid-edit. The branch lives in `isOpen`. -->
{@render viewOptionsSheet()}
{@render detailSheet()}

<!-- Create saved view -->
{@render adaptiveSavedViewForm(
	'Create new saved view',
	'Captures the filters and the table configuration as they are now.',
	creatingName != null,
	(open) => (creatingName = open ? '' : null),
	createFormChildren
)}

<!-- Edit saved view -->
{@render adaptiveSavedViewForm(
	'Edit saved view',
	'Renaming only. The configuration is what was captured when the view was saved.',
	editing != null,
	(open) => !open && (editing = null),
	editFormChildren
)}

<style>
	/* height="fill" resolves to height:100%, which needs a definite height the
	   host's <html>/<body> don't set. Without it the shell grows to fit the
	   table, the document scrolls, and the end panel rides away with it. */
	:global(.tf-page-shell) {
		height: 100dvh;
		/* Layout is transparent by design, so without this the shell inherits
		   whatever the host paints. */
		background-color: var(--color-background-surface);
		/* A pinned cell paints an opaque base so scrolled content cannot show
		   through it, and that base defaults to the card token — right for a table
		   inside a card, wrong for this one, which sits on the page surface. */
		--table-sticky-background: var(--color-background-surface);
	}
	/* A wrapped row's `gap` sets both axes, and 8px between stacked lines is more
	   air than these need. */
	:global(.tf-bar) {
		row-gap: 6px;
	}
	:global(.tf-filter-row) {
		row-gap: 6px;
	}
	/* The slot is what `observeParent` measures, so its width has to mean "the
	   room the clauses have". Grow is the part that makes that true; without it
	   the slot is content-sized and feeds the list its own output. */
	:global(.tf-filter-slot) {
		display: flex;
		align-items: center;
		flex-grow: 1;
		/* The held-back width, as padding because padding is the one part of the
		   box the measurement already subtracts. */
		padding-inline-end: 184px;
		flex-shrink: 100;
		min-width: 228px;
	}
	:global(.tf-overflow-item) {
		display: flex;
		flex-direction: column;
	}
	/* Queried rather than @media: opening the detail panel narrows this header
	   without the viewport changing, and that is the width the toolbar has to
	   fit in. */
	:global(.tf-toolbar-container) {
		container-name: toolbar;
		container-type: inline-size;
	}
	/* Taking the full line forces the trailing cluster onto a second row. */
	:global(.tf-toolbar-primary) {
		flex-basis: 0;
	}
	@container toolbar (max-width: 860px) {
		:global(.tf-toolbar-primary) {
			flex-basis: 100%;
		}
	}
	/* Holds the cluster against the end edge on its own row, where it would
	   otherwise sit under the filters at the start. */
	:global(.tf-toolbar-end) {
		margin-inline-start: auto;
	}
	/* Takes back the width the slot held back for it, so the readout draws over
	   the reserve rather than after it and lands against the last clause. */
	:global(.tf-filter-meta) {
		flex-shrink: 0;
		margin-inline-start: 8px;
		margin-inline-end: -184px;
	}
	:global(.tf-saved-views-label) {
		flex-shrink: 0;
	}
	:global(.tf-saved-views-slot) {
		flex-shrink: 1;
		min-width: 0;
	}
	:global(.tf-saved-views-scroller) {
		overflow-x: auto;
		/* The row is one line: without this the block axis picks up a scrollbar
		   the moment the inline one appears. */
		overflow-y: hidden;
		overscroll-behavior-inline: contain;
		scrollbar-width: none;
	}
	/* In a nowrap row that scrolls, a shrinkable child squeezes to fit rather
	   than overflowing. */
	:global(.tf-saved-view-chip) {
		flex-shrink: 0;
	}
	:global(.tf-filter-token) {
		min-width: 0;
		max-width: 100%;
	}
	:global(.tf-progress) {
		position: absolute;
		inset-block-start: 0;
		inset-inline: 0;
	}
	:global(.tf-header-wrap) {
		position: relative;
	}
	/* The bulk bar sits inside the header's 16px gutter, so it needs a corner
	   radius to read as a band rather than a clipped full-bleed strip. */
	:global(.tf-bulk-band) {
		border-radius: var(--radius-element);
		/* The bar mounts the moment the first row is checked, so its entry is a
		   `@starting-style` transition rather than a keyframe: the settled value is
		   the one written here. */
		opacity: 1;
		transform: translateY(0);
		transition-property: opacity, transform;
		transition-duration: var(--duration-medium, 200ms);
		transition-timing-function: var(--ease-standard, ease);
	}
	:global(.tf-bulk-band) {
		@starting-style {
			opacity: 0;
			transform: translateY(var(--spacing-3));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.tf-bulk-band) {
			transition-duration: 0s;
		}
	}
	/* Sits at the width of the filter selectors beside it so the row reads as one
	   family of controls, and widens on focus for typing room. */
	:global(.tf-search-slot) {
		flex-shrink: 1;
		min-width: 120px;
		width: 120px;
		transition-property: width;
		transition-duration: var(--duration-fast, 100ms);
		transition-timing-function: var(--ease-standard, ease);
	}
	:global(.tf-search-slot:focus-within) {
		width: 240px;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.tf-search-slot) {
			transition-duration: 0s;
		}
	}
	/* ButtonVariantMap has no outline variant, so the Button-backed toggles in
	   the row paint the field chrome the selectors beside them draw natively. */
	:global(.tf-chrome) {
		border-width: var(--border-width);
		border-style: solid;
		border-color: var(--color-border-emphasized);
		border-radius: var(--radius-element);
	}
	:global(.tf-surface) {
		background-color: var(--color-background-surface);
	}
	/* The fill a control switches to once it carries a value — the token
	   ToggleButton paints for its own pressed state, so a set selector and a
	   pressed preset land on the same value. */
	:global(.tf-fill) {
		background-color: var(--color-overlay-pressed);
	}
	/* A Selector states its own emptiness typographically; Button labels are
	   medium and always primary, so the toggles are normalised. */
	:global(.tf-label-value) {
		font-weight: var(--font-weight-normal);
	}
	:global(.tf-label-empty) {
		font-weight: var(--font-weight-normal);
		color: var(--color-text-secondary);
	}
	/* Popover paints a 12px gutter on its content container and publishes no
	   padding prop. Flush, the rail's divider and the footer rule reach the
	   popover edges, and each region below re-states its own gutter. */
	:global(.tf-view-popover) {
		block-size: 448px;
		padding: 0;
	}
	:global(.tf-view-rail) {
		width: 184px;
		flex-shrink: 0;
	}
	/* Pairs with the rail's 4px gutter: the item keeps Button's own
	   --radius-element and sits inside the popover's --radius-container. */
	:global(.tf-rail-item) {
		width: 100%;
		justify-content: flex-start;
	}
	:global(.tf-view-sheet-tabs) {
		padding-inline: 16px;
	}
	:global(.tf-view-panel) {
		block-size: 100%;
		flex-grow: 1;
		min-width: 0;
	}
	/* --- Columns transfer list ------------------------------------------------- */
	:global(.tf-transfer-root) {
		flex-grow: 1;
		min-height: 0;
		min-width: 0;
	}
	:global(.tf-transfer-panels) {
		flex-grow: 1;
		min-height: 0;
		min-width: 0;
	}
	/* flexBasis 0 with grow splits the row into two equal halves; the two
	   minimums then let a half shrink below its content. */
	:global(.tf-transfer-panel) {
		flex-basis: 0;
		flex-grow: 1;
		min-block-size: 0;
		min-width: 0;
		overflow: hidden;
	}
	:global(.tf-transfer-pad-start) {
		padding-inline-end: var(--spacing-3);
		padding-inline-start: var(--spacing-4);
	}
	:global(.tf-transfer-pad-end) {
		padding-inline-end: var(--spacing-4);
		padding-inline-start: var(--spacing-3);
	}
	:global(.tf-transfer-divider) {
		border-inline-start-color: var(--color-border);
		border-inline-start-style: solid;
		border-inline-start-width: var(--border-width);
	}
	:global(.tf-transfer-header) {
		border-block-end-color: var(--color-border);
		border-block-end-style: solid;
		border-block-end-width: var(--border-width);
	}
	/* The bulk action sits on the header rule beside a label, where button chrome
	   would outweigh the list it acts on. */
	:global(.tf-transfer-header-action) {
		background-image: none;
		border-radius: 0;
		color: var(--color-text-accent);
		font-size: var(--text-body-size);
		font-weight: var(--text-body-weight);
		height: auto;
		min-height: 0;
		line-height: var(--text-body-leading);
		padding-block: 0;
		padding-inline: 0;
		text-decoration: none;
	}
	:global(.tf-transfer-header-action:hover:not(:disabled)) {
		text-decoration: underline;
	}
	/* Each panel scrolls its own rows within whatever height the pane gives it. */
	:global(.tf-transfer-body) {
		flex-grow: 1;
		min-block-size: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
	}
	/* Padded by transferPadStart/End rather than Item's own gutter, so a row's
	   hover fill runs the full width of the panel while its text stays on the
	   header's start line. */
	:global(.tf-transfer-item) {
		min-width: 0;
		transition-duration: var(--duration-fast, 100ms);
		transition-property: background-color, opacity;
		transition-timing-function: var(--ease-standard, ease);
	}
	/* A keyboard pick-up has no pointer under it to say what is moving, so the
	   row itself carries the state. */
	:global(.tf-transfer-picked) {
		background-color: var(--color-accent-muted);
	}
	:global(.tf-transfer-empty) {
		text-align: center;
	}
	/* A ghost IconButton insets its glyph by --spacing-1-5; cancelling that puts
	   the grip itself on the panel's start line rather than the button box. */
	:global(.tf-transfer-grip) {
		margin-inline-start: calc(-1 * var(--spacing-1-5));
	}
	:global(.tf-transfer-end-action) {
		margin-inline-end: calc(-1 * var(--spacing-1-5));
	}
	:global(.tf-row-clickable) {
		cursor: pointer;
	}
	/* One step past hover in the same neutral ramp. Row background belongs to
	   this state alone: selection opts out of its wash so the two never compete. */
	:global(.tf-row-active) {
		background-color: var(--color-overlay-pressed);
		/* A pinned cell paints an opaque background of its own, which would cover
		   the row's. Publishing the overlay is how the sticky plugin replays it. */
		--table-row-overlay: var(--color-overlay-pressed);
	}
	/* A flex child has no definite width for AspectRatio to derive a height
	   from, so the tile is pinned here. */
	:global(.tf-job-media) {
		background-color: var(--color-background-muted);
		border-radius: var(--radius-element);
		flex-shrink: 0;
		width: var(--spacing-12);
	}
	:global(.tf-detail-panel) {
		min-width: 0;
	}
	/* The table drops the divider under its last row, so each placeholder
	   carries its own on top — one line between every row, none trailing. */
	:global(.tf-skeleton-row) {
		border-block-start-color: var(--color-border);
		border-block-start-style: solid;
		border-block-start-width: var(--border-width);
	}
	/* The table bleeds past this container to the layout edge and re-applies the
	   inset on its outer cells. Matching that keeps the two grids on one axis. */
	:global(.tf-skeleton-bleed) {
		margin-inline: calc(-1 * var(--container-padding-inline-start, 0px));
	}
	/* --- Column reorder ------------------------------------------------------- */
	:global(.tf-reorder-source) {
		opacity: 0.5;
		user-select: none;
	}
	:global(.tf-reorder-before),
	:global(.tf-reorder-after) {
		position: relative;
	}
	:global(.tf-reorder-before::before),
	:global(.tf-reorder-after::after) {
		background-color: var(--color-accent);
		border-radius: var(--radius-full);
		content: '';
		height: var(--spacing-0-5);
		inset-inline: 0;
		pointer-events: none;
		position: absolute;
		z-index: 2;
	}
	:global(.tf-reorder-before::before) {
		inset-block-start: calc(-1 * var(--spacing-0-5));
	}
	:global(.tf-reorder-after::after) {
		inset-block-end: calc(-1 * var(--spacing-0-5));
	}
	:global(.tf-reorder-handle) {
		cursor: grab;
		touch-action: none;
	}
	:global(.tf-reorder-handle-active) {
		cursor: grabbing;
		touch-action: none;
	}
</style>
