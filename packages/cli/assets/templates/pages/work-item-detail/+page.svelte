<!--
	Ported from upstream's `assets/templates/pages/work-item-detail/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Heroicons, upstream's own set: `@fvilers/heroicons-svelte` is that
	set built for Svelte 5, keeping upstream's names and entry points.

	Upstream's two StyleX rules are inline styles here, because a `.svelte` file
	may not import StyleX: `breadcrumbRule` (`height: 12px`) lands on the two
	vertical `Divider`s, and `attachmentTile` (40px, muted fill, element radius)
	on the `AspectRatio` around each attachment glyph, using the same token
	variables `colorVars`/`radiusVars` resolve to.

	`rtlStyles.mirror` is reproduced by the `template-mirror` class and the rule
	at the bottom of this file.

	Every local component upstream is a snippet. Option lists drop their
	`icon: ReactNode` entries and instead render the icon through Selector's
	`renderValue`/`renderOption` snippets, which is the same slot upstream's
	default renderer fills — `StatusDot`, `Avatar` and `PriorityBadge` still draw
	the glyph and the label. `ActivitySection`'s comment field takes an `id` and
	is focused through it, since no component publishes a `ref`.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		AspectRatio,
		Avatar,
		AvatarGroup,
		Badge,
		Button,
		Card,
		CheckboxListItem,
		ClickableCard,
		Dialog,
		DialogHeader,
		Divider,
		HStack,
		Heading,
		Icon,
		IconButton,
		Layout,
		LayoutContent,
		LayoutHeader,
		LayoutPanel,
		Link,
		List,
		ListItem,
		MetadataList,
		MetadataListItem,
		MoreMenu,
		ProgressBar,
		Section,
		Selector,
		StackItem,
		StatusDot,
		Text,
		TextArea,
		Timestamp,
		Token,
		Tokenizer,
		VStack,
		useMediaQuery,
		type BadgeVariant,
		type DropdownMenuOption,
		type SearchableItem,
		type SearchSource,
		type SelectorOptionData,
		type StatusDotVariant
	} from '@astryx-sv/core';
	import {
		ArrowLeftIcon,
		BellIcon,
		DocumentTextIcon,
		EyeIcon,
		InformationCircleIcon,
		LinkIcon,
		PencilIcon,
		PhotoIcon,
		ShareIcon,
		TrashIcon,
		ViewColumnsIcon
	} from '@fvilers/heroicons-svelte/24/outline';

	// ─── Editable fields ────────────────────────────────────────────────────────
	/** Shape shared by every Selector option list on this page. */
	type Option = { value: string; label: string };

	const STATUS_OPTIONS: Option[] = [
		{ value: 'todo', label: 'To Do' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'in_review', label: 'In Review' },
		{ value: 'done', label: 'Done' }
	];

	const STATUS_VARIANTS: Record<string, StatusDotVariant> = {
		todo: 'neutral',
		in_progress: 'accent',
		in_review: 'warning',
		done: 'success'
	};

	const ASSIGNEE_OPTIONS: Option[] = [
		{ value: 'priya-shah', label: 'Priya Shah' },
		{ value: 'marcus-chen', label: 'Marcus Chen' },
		{ value: 'sofia-alvarez', label: 'Sofia Alvarez' }
	];

	// The badge colour rides along with the option so the list stays the single
	// source of truth; a separate switch would have to be kept in step by hand.
	const PRIORITY_OPTIONS: (Option & { badge: BadgeVariant })[] = [
		{ value: 'high', label: 'High', badge: 'red' },
		{ value: 'mid', label: 'Mid', badge: 'orange' },
		{ value: 'low', label: 'Low', badge: 'yellow' },
		{ value: 'none', label: 'None', badge: 'neutral' }
	];

	type LabelOption = SearchableItem & { color: 'blue' | 'green' | 'purple' };

	const LABEL_OPTIONS: LabelOption[] = [
		{ id: 'onboarding', label: 'Onboarding', color: 'purple' },
		{ id: 'q1-goal', label: 'Q1 goal', color: 'blue' },
		{ id: 'growth', label: 'Growth', color: 'green' }
	];

	const LABEL_SEARCH_SOURCE: SearchSource<LabelOption> = {
		search: (query) =>
			LABEL_OPTIONS.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
		bootstrap: () => LABEL_OPTIONS
	};

	/** Every editable field on the work item, held as one unit of page state. */
	type WorkItemFields = {
		status: string;
		assignee: string;
		priority: string;
		labels: LabelOption[];
	};

	/**
	 * The options list defines the valid values, so an unrecognised one falls back
	 * to the first entry rather than leaving the slot empty.
	 */
	function optionFor<T extends Option>(options: T[], value: string): T {
		return options.find((option) => option.value === value) ?? options[0];
	}

	// ─── Work item data ─────────────────────────────────────────────────────────
	type Subtask = {
		id: number;
		title: string;
		isDone: boolean;
		assignee: string;
		due: string;
	};

	const SUBTASKS: Subtask[] = [
		{
			id: 1,
			title: 'Audit current onboarding flow and note friction points',
			isDone: true,
			assignee: 'Priya Shah',
			due: '2026-03-04'
		},
		{
			id: 2,
			title: 'Interview five recent sign-ups about their first-run experience',
			isDone: true,
			assignee: 'Marcus Chen',
			due: '2026-03-06'
		},
		{
			id: 3,
			title: 'Draft revised welcome sequence with three variants',
			isDone: false,
			assignee: 'Priya Shah',
			due: '2026-03-11'
		},
		{
			id: 4,
			title: 'Review copy with content design and legal',
			isDone: false,
			assignee: 'Sofia Alvarez',
			due: '2026-03-13'
		},
		{
			id: 5,
			title: 'Ship variant A to 10% of new accounts and measure activation',
			isDone: false,
			assignee: 'Marcus Chen',
			due: '2026-03-18'
		}
	];

	type Attachment = {
		id: string;
		kind: 'link' | 'image' | 'file';
		title: string;
		subtitle: string;
		href: string;
	};

	const ATTACHMENTS: Attachment[] = [
		{
			id: 'audit-notes',
			kind: 'link',
			title: 'Onboarding audit notes',
			subtitle: 'docs.example.com',
			href: '#'
		},
		{
			id: 'funnel-dashboard',
			kind: 'link',
			title: 'Sign-up funnel dashboard',
			subtitle: 'analytics.example.com',
			href: '#'
		},
		{
			id: 'welcome-screen',
			kind: 'image',
			title: 'welcome-screen-v3.png',
			subtitle: '1.4 MB · Added 2 days ago',
			href: '#'
		},
		{
			id: 'transcripts',
			kind: 'file',
			title: 'Interview transcripts.pdf',
			subtitle: '820 KB · Added 3 days ago',
			href: '#'
		}
	];

	const ATTACHMENT_ICONS = {
		link: LinkIcon,
		image: PhotoIcon,
		file: DocumentTextIcon
	};

	const HEADER_ACTIONS = [
		{ label: 'Watch', icon: EyeIcon },
		{ label: 'Share', icon: ShareIcon },
		{ label: 'Notify', icon: BellIcon }
	];

	const WATCHERS = [
		'Priya Shah',
		'Marcus Chen',
		'Sofia Alvarez',
		'Jordan Blake',
		'Lin Wei',
		'Aisha Okafor'
	];

	const LINKED_ITEMS = [
		{ id: 'PLT-238', title: 'Track activation rate by acquisition channel' },
		{ id: 'PLT-241', title: 'Welcome email A/B test — copy variants' }
	];

	type ActivityEntry = {
		id: number;
		kind: 'comment' | 'event';
		author: string;
		time: string;
		body: string;
	};

	const ACTIVITY: ActivityEntry[] = [
		{
			id: 1,
			kind: 'event',
			author: 'Sofia Alvarez',
			time: '2026-03-02T14:12:00Z',
			body: 'created this task'
		},
		{
			id: 2,
			kind: 'comment',
			author: 'Priya Shah',
			time: '2026-03-03T09:41:00Z',
			body: 'Finished the audit — three biggest friction points are the account form length, the empty first-run dashboard, and the tour tooltip cluster on step two. Full notes in the linked doc.'
		},
		{
			id: 3,
			kind: 'event',
			author: 'Marcus Chen',
			time: '2026-03-03T15:20:00Z',
			body: 'changed status from To Do to In Progress'
		},
		{
			id: 4,
			kind: 'comment',
			author: 'Marcus Chen',
			time: '2026-03-04T10:05:00Z',
			body: 'Interviews wrapped. A consistent theme: people expect a personalized starting workspace and get an empty one. Suggest we scope a template step into variant A.'
		},
		{
			id: 5,
			kind: 'event',
			author: 'Sofia Alvarez',
			time: '2026-03-04T16:48:00Z',
			body: 'assigned this task to Priya Shah'
		}
	];

	// ─── Shared pieces ──────────────────────────────────────────────────────────
	// A Section escapes its container's padding by design — it cancels
	// --container-padding-* with negative margins so fills can run edge to edge.
	// LayoutContent's own padding is therefore invisible in the main column; this
	// is the value that actually sets its inset.
	const SECTION_PADDING = 6;

	// A vertical rule has no intrinsic height and the breadcrumb row centers its
	// children rather than stretching them, so the separator needs its own.
	const breadcrumbRule = 'height: 12px;';
	// Fixed square tile the attachment icon centers in. AspectRatio keeps it
	// square; the width is what stops it growing with the row.
	const attachmentTile =
		'width: 40px; background-color: var(--color-background-muted); border-radius: var(--radius-element);';

	const isNarrow = useMediaQuery(() => '(max-width: 1024px)');
	const commentFieldId = $props.id();

	// The details live in a rail on wide screens and a dialog on narrow ones.
	// Each keeps its own flag: the rail is open by default, while the dialog must
	// stay shut until asked for, so one shared initial value cannot serve both.
	let isRailOpen = $state(true);
	let isDialogOpen = $state(false);
	const isDetailsOpen = $derived(isNarrow.matches ? isDialogOpen : isRailOpen);

	let fields = $state<WorkItemFields>({
		status: 'in_progress',
		assignee: 'priya-shah',
		priority: 'high',
		labels: LABEL_OPTIONS
	});
	let subtasks = $state<Subtask[]>(SUBTASKS);
	let comment = $state('');

	const updateFields = (patch: Partial<WorkItemFields>) => (fields = { ...fields, ...patch });

	const setDetailsOpen = (next: boolean) => {
		if (isNarrow.matches) {
			isDialogOpen = next;
		} else {
			isRailOpen = next;
		}
	};

	const toggleDetails = () => setDetailsOpen(!isDetailsOpen);

	const setSubtaskDone = (id: number, isDone: boolean) =>
		(subtasks = subtasks.map((task) => (task.id === id ? { ...task, isDone } : task)));

	const focusCommentField = () => {
		// Scroll first, then take focus without a second jump competing with it.
		const field = document.getElementById(commentFieldId);
		if (!field) {
			return;
		}
		field.scrollIntoView({ behavior: 'smooth', block: 'center' });
		field.focus({ preventScroll: true });
	};
</script>

<!-- ─── Option renderers ─────────────────────────────────────────────────────── -->
{#snippet priorityBadge(value: string)}
	{@const option = optionFor(PRIORITY_OPTIONS, value)}
	<Badge variant={option.badge} label={option.label} />
{/snippet}

{#snippet statusOption(option: SelectorOptionData)}
	<HStack gap={2} vAlign="center">
		<StatusDot
			variant={STATUS_VARIANTS[option.value] ?? 'neutral'}
			label={option.label ?? option.value}
		/>
		<Text type="body">{option.label}</Text>
	</HStack>
{/snippet}

{#snippet assigneeOption(option: SelectorOptionData)}
	<HStack gap={2} vAlign="center">
		<Avatar name={option.label ?? option.value} size="xsm" />
		<Text type="body">{option.label}</Text>
	</HStack>
{/snippet}

{#snippet priorityOption(option: SelectorOptionData)}
	{@render priorityBadge(option.value)}
{/snippet}

{#snippet labelToken(label: LabelOption, onRemove: () => void)}
	<Token label={label.label} color={label.color} onRemove={onRemove} />
{/snippet}

<!-- ─── Shared pieces ────────────────────────────────────────────────────────── -->
{#snippet sectionHeader(title: string, level?: 2 | 3, action?: Snippet)}
	<HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
		<Heading level={level ?? 2}>{title}</Heading>
		{#if action}{@render action()}{/if}
	</HStack>
{/snippet}

{#snippet personRow(name: string)}
	<HStack gap={2} vAlign="center">
		<Avatar name={name} size="xsm" />
		<Text type="body">{name}</Text>
	</HStack>
{/snippet}

{#snippet allTasksLink()}
	<Link href="#" type="supporting" color="secondary">
		<HStack as="span" gap={1} vAlign="center">
			<Icon icon={ArrowLeftIcon} size="sm" class="template-mirror" />
			All Tasks
		</HStack>
	</Link>
{/snippet}

{#snippet watchIcon()}
	<Icon icon={EyeIcon} size="sm" />
{/snippet}

{#snippet shareIcon()}
	<Icon icon={ShareIcon} size="sm" />
{/snippet}

{#snippet notifyIcon()}
	<Icon icon={BellIcon} size="sm" />
{/snippet}

{#snippet infoIcon()}
	<Icon icon={InformationCircleIcon} size="sm" />
{/snippet}

{#snippet viewColumnsIcon()}
	<Icon icon={ViewColumnsIcon} size="sm" />
{/snippet}

{#snippet editIcon()}
	<Icon icon={PencilIcon} size="sm" />
{/snippet}

{#snippet deleteIcon()}
	<Icon icon={TrashIcon} size="sm" />
{/snippet}

<!-- ─── Page header ──────────────────────────────────────────────────────────── -->
{#snippet pageHeader()}
	<LayoutHeader padding={6} hasDivider>
		<VStack gap={4}>
			<HStack gap={4} vAlign="start" hAlign="between">
				<VStack gap={2}>
					<HStack gap={4} vAlign="center" wrap="wrap">
						{@render allTasksLink()}
						<Divider orientation="vertical" style={breadcrumbRule} />
						<Text type="supporting" color="secondary">PLT-247</Text>
						<Divider orientation="vertical" style={breadcrumbRule} />
						<Text type="supporting" color="secondary">Platform / Onboarding</Text>
					</HStack>
					<Heading level={1} maxLines={2}>Refresh onboarding flow for workspaces</Heading>
				</VStack>
				{#if isNarrow.matches}
					<IconButton
						label="Show details"
						variant="secondary"
						icon={infoIcon}
						onclick={toggleDetails}
					/>
				{:else}
					<HStack gap={1}>
						{#each HEADER_ACTIONS as action (action.label)}
							<IconButton
								label={action.label}
								variant="secondary"
								icon={action.label === 'Watch'
									? watchIcon
									: action.label === 'Share'
										? shareIcon
										: notifyIcon}
							/>
						{/each}
						<Button
							label={isDetailsOpen ? 'Hide details' : 'Show details'}
							variant="secondary"
							icon={viewColumnsIcon}
							onclick={toggleDetails}
						/>
					</HStack>
				{/if}
			</HStack>
			<HStack gap={1} vAlign="center" wrap="wrap">
				<Selector
					label="Status"
					isLabelHidden
					value={fields.status}
					onChange={(status: string) => updateFields({ status })}
					options={STATUS_OPTIONS}
					renderValue={statusOption}
					renderOption={statusOption}
				/>
				<Selector
					label="Priority"
					isLabelHidden
					value={fields.priority}
					onChange={(priority: string) => updateFields({ priority })}
					options={PRIORITY_OPTIONS}
					renderValue={priorityOption}
					renderOption={priorityOption}
				/>
				<Selector
					label="Assignee"
					isLabelHidden
					hasSearch
					searchPlaceholder="Search assignees..."
					value={fields.assignee}
					onChange={(assignee: string) => updateFields({ assignee })}
					options={ASSIGNEE_OPTIONS}
					renderValue={assigneeOption}
					renderOption={assigneeOption}
				/>
				<Tokenizer
					label="Labels"
					isLabelHidden
					searchSource={LABEL_SEARCH_SOURCE}
					value={fields.labels}
					onChange={(labels: LabelOption[]) => updateFields({ labels })}
					renderToken={labelToken}
				/>
			</HStack>
		</VStack>
	</LayoutHeader>
{/snippet}

<!-- ─── Description ──────────────────────────────────────────────────────────── -->
{#snippet descriptionSection()}
	<Section padding={SECTION_PADDING}>
		<VStack gap={4}>
			{@render sectionHeader('Description')}
			<VStack gap={2}>
				<Text type="body">
					Reduce the drop-off between account creation and first meaningful action in a new
					workspace. Recent cohorts activate at 42 percent by day seven, and interview evidence
					points to an empty starting state and a long welcome sequence as the two largest
					contributors.
				</Text>
				<Text type="body">
					Ship a revised flow that shortens the sequence, seeds every new workspace with a sample
					project, and measures activation as the percentage of workspaces that reach three
					completed actions in the first three days.
				</Text>
			</VStack>
			<VStack gap={2}>
				<!--
					Sized as a level 4 but announced as a level 3, so the visual scale
					stays small without skipping a step in the document outline.
				-->
				<Heading level={4} accessibilityLevel={3}>Success criteria</Heading>
				<List listStyle="disc" density="compact">
					<ListItem
						label="Day-seven activation rises from 42 to 55 percent for new workspaces in the variant."
					/>
					<ListItem label="Median time to first completed action drops below eight minutes." />
					<ListItem label="No regression in day-thirty retention." />
				</List>
			</VStack>
		</VStack>
	</Section>
{/snippet}

<!-- ─── Subtasks ─────────────────────────────────────────────────────────────── -->
{#snippet addSubtaskButton()}
	<Button label="Add subtask" />
{/snippet}

{#snippet subtasksSection()}
	{@const doneCount = subtasks.filter((task) => task.isDone).length}
	<Section padding={SECTION_PADDING}>
		<VStack gap={4}>
			{@render sectionHeader('Subtasks', 2, addSubtaskButton)}
			<HStack gap={3} vAlign="center">
				<Text type="supporting" color="secondary">
					{doneCount} of {subtasks.length} complete
				</Text>
				<StackItem size="fill">
					<ProgressBar
						label="Subtask progress"
						isLabelHidden
						value={subtasks.length ? (doneCount / subtasks.length) * 100 : 0}
						variant="success"
					/>
				</StackItem>
			</HStack>
			<List>
				{#each subtasks as task (task.id)}
					{#snippet subtaskEnd()}
						<HStack gap={2} vAlign="center">
							<Timestamp
								value={task.due}
								format="date"
								type="supporting"
								color="secondary"
							/>
							<Avatar name={task.assignee} size="sm" />
						</HStack>
					{/snippet}
					<CheckboxListItem
						label={task.title}
						isChecked={task.isDone}
						onCheck={(isDone) => setSubtaskDone(task.id, isDone)}
						endContent={subtaskEnd}
					/>
				{/each}
			</List>
		</VStack>
	</Section>
{/snippet}

<!-- ─── Attachments ──────────────────────────────────────────────────────────── -->
{#snippet addAttachmentButton()}
	<Button label="Add attachment" />
{/snippet}

{#snippet attachmentsSection()}
	<Section padding={SECTION_PADDING}>
		<VStack gap={4}>
			{@render sectionHeader('Attachments', 2, addAttachmentButton)}
			<VStack gap={1}>
				{#each ATTACHMENTS as attachment (attachment.id)}
					{@const attachmentActions: DropdownMenuOption[] = [
						{ label: 'Edit', icon: editIcon },
						{ label: 'Delete', icon: deleteIcon, variant: 'destructive' }
					]}
					<ClickableCard
						label={`Open ${attachment.title}`}
						href={attachment.href}
						padding={3}
					>
						<HStack gap={4} vAlign="center">
							<AspectRatio ratio={1} fit="center" style={attachmentTile}>
								<Icon
									icon={ATTACHMENT_ICONS[attachment.kind]}
									size="lg"
									color="secondary"
								/>
							</AspectRatio>
							<StackItem size="fill">
								<VStack gap={0}>
									<Text type="body" weight="semibold">{attachment.title}</Text>
									<Text type="supporting" color="secondary">{attachment.subtitle}</Text>
								</VStack>
							</StackItem>
							<MoreMenu
								label={`Actions for ${attachment.title}`}
								items={attachmentActions}
							/>
						</HStack>
					</ClickableCard>
				{/each}
			</VStack>
		</VStack>
	</Section>
{/snippet}

<!-- ─── Activity ─────────────────────────────────────────────────────────────── -->
{#snippet addCommentButton()}
	<Button label="Add comment" onclick={focusCommentField} />
{/snippet}

{#snippet activitySection()}
	<Section padding={SECTION_PADDING}>
		<VStack gap={10}>
			{@render sectionHeader('Comments and activity', 2, addCommentButton)}
			<VStack gap={6}>
				{#each ACTIVITY as entry (entry.id)}
					{@const isComment = entry.kind === 'comment'}
					<HStack gap={3} vAlign="start">
						<Avatar name={entry.author} size="sm" />
						<StackItem size="fill">
							<VStack gap={1}>
								<HStack gap={2} vAlign="center">
									<Text type="body" weight="semibold">{entry.author}</Text>
									<!--
										An event is one line, so its body sits on the byline
										instead of getting a bubble of its own.
									-->
									{#if !isComment}
										<Text type="supporting" color="secondary">{entry.body}</Text>
									{/if}
									<StackItem size="fill" />
									<Timestamp
										value={entry.time}
										format="relative"
										type="supporting"
										color="secondary"
									/>
								</HStack>
								{#if isComment}
									<Card variant="muted" padding={3}>
										<Text type="body">{entry.body}</Text>
									</Card>
									<Link href="#" color="secondary">Reply</Link>
								{/if}
							</VStack>
						</StackItem>
					</HStack>
				{/each}
			</VStack>
			<VStack gap={2} hAlign="stretch">
				<TextArea
					id={commentFieldId}
					width="100%"
					label="Add a comment"
					isLabelHidden
					placeholder="Write a comment…"
					value={comment}
					onChange={(value: string) => (comment = value)}
					rows={5}
				/>
				<HStack gap={2} hAlign="end">
					<Button label="Cancel" variant="ghost" />
					<Button
						label="Comment"
						variant="primary"
						isDisabled={comment.trim().length === 0}
					/>
				</HStack>
			</VStack>
		</VStack>
	</Section>
{/snippet}

<!-- ─── Details rail ─────────────────────────────────────────────────────────── -->
{#snippet detailsPanel()}
	{@const status = optionFor(STATUS_OPTIONS, fields.status)}
	{@const assignee = optionFor(ASSIGNEE_OPTIONS, fields.assignee)}
	<VStack gap={10}>
		<VStack gap={4}>
			{@render sectionHeader('Details', 3)}
			<MetadataList>
				<MetadataListItem label="Status">
					<HStack gap={2} vAlign="center">
						<StatusDot
							variant={STATUS_VARIANTS[status.value] ?? 'neutral'}
							label={status.label}
						/>
						<Text type="body">{status.label}</Text>
					</HStack>
				</MetadataListItem>
				<MetadataListItem label="Priority">
					{@render priorityBadge(fields.priority)}
				</MetadataListItem>
				<MetadataListItem label="Assignee">
					{@render personRow(assignee.label)}
				</MetadataListItem>
				<MetadataListItem label="Reporter">
					{@render personRow('Sofia Alvarez')}
				</MetadataListItem>
				<MetadataListItem label="Start date">
					<Timestamp value="2026-03-02" format="date" type="body" color="primary" />
				</MetadataListItem>
				<MetadataListItem label="Due date">
					<Timestamp value="2026-03-18" format="date" type="body" color="primary" />
				</MetadataListItem>
				<MetadataListItem label="Sprint">
					<Text type="body">Sprint 24 · Mar 2 – Mar 15</Text>
				</MetadataListItem>
				<MetadataListItem label="Parent">
					<Link href="#">PLT-192 · Activation initiative</Link>
				</MetadataListItem>
				<MetadataListItem label="Labels">
					<HStack gap={1} wrap="wrap">
						{#each fields.labels as label (label.id)}
							<Token color={label.color} label={label.label} size="sm" />
						{/each}
					</HStack>
				</MetadataListItem>
				<MetadataListItem label="Team">
					<Text type="body">Platform · Growth pod</Text>
				</MetadataListItem>
			</MetadataList>
		</VStack>

		<VStack gap={4}>
			{@render sectionHeader('Watchers', 3)}
			<AvatarGroup size="md">
				{#each WATCHERS as name (name)}
					<Avatar {name} />
				{/each}
			</AvatarGroup>
		</VStack>

		<VStack gap={4}>
			{@render sectionHeader('Linked items', 3)}
			<VStack gap={1}>
				{#each LINKED_ITEMS as item (item.id)}
					<ClickableCard label={`Open ${item.id}: ${item.title}`} href="#" padding={3}>
						<VStack gap={0}>
							<Text type="supporting" color="secondary">{item.id}</Text>
							<Text type="body" weight="semibold">{item.title}</Text>
						</VStack>
					</ClickableCard>
				{/each}
			</VStack>
		</VStack>
	</VStack>
{/snippet}

{#snippet layoutContent()}
	<LayoutContent padding={6} role="main">
		<VStack gap={6}>
			{@render descriptionSection()}
			<Divider />
			{@render subtasksSection()}
			<Divider />
			{@render attachmentsSection()}
			<Divider />
			{@render activitySection()}
		</VStack>
	</LayoutContent>
{/snippet}

{#snippet endPanel()}
	<LayoutPanel width={340} padding={6} role="complementary" hasDivider>
		{@render detailsPanel()}
	</LayoutPanel>
{/snippet}

{#snippet dialogHeader()}
	<DialogHeader title="Task details" onOpenChange={(open) => (isDialogOpen = open)} />
{/snippet}

{#snippet dialogContent()}
	<LayoutContent padding={4}>
		{@render detailsPanel()}
	</LayoutContent>
{/snippet}

<!-- ─── Page ─────────────────────────────────────────────────────────────────── -->
<Layout
	height="fill"
	contentWidth={1260}
	header={pageHeader}
	content={layoutContent}
	end={!isNarrow.matches && isDetailsOpen ? endPanel : undefined}
/>
<Dialog
	variant="fullscreen"
	isOpen={isNarrow.matches && isDetailsOpen}
	onOpenChange={(open) => (isDialogOpen = open)}
>
	<Layout header={dialogHeader} content={dialogContent} />
</Dialog>

<style>
	:global([dir='rtl']) :global(.template-mirror) {
		transform: scaleX(-1);
	}
</style>
