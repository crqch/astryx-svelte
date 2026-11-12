<!--
	Ported from upstream's `assets/templates/pages/form-wizard-dialog/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Upstream's `React.useState` calls are `$state` runes. `errorsByStep` and
	`cadenceSummary` are derived values in upstream's own render, so they are
	`$derived` here; every helper keeps upstream's name and body.

	The prose the page's own doc comment carries — why a modal wizard is the
	right call here, and what its constraints are — is upstream's design note,
	not an instruction to this port, so it is left with upstream's file rather
	than repeated here.
-->
<script lang="ts">
	import {
		Banner,
		Button,
		Center,
		CheckboxList,
		CheckboxListItem,
		DateInput,
		Dialog,
		DialogHeader,
		Divider,
		Field,
		FieldStatus,
		FormLayout,
		HStack,
		Layout,
		LayoutContent,
		LayoutFooter,
		LayoutHeader,
		MetadataList,
		MetadataListItem,
		MultiSelector,
		RadioList,
		RadioListItem,
		SegmentedControl,
		SegmentedControlItem,
		Selector,
		StackItem,
		Step,
		Stepper,
		Switch,
		TextArea,
		TextInput,
		TimeInput,
		VStack,
		useToast,
		type ISODateString,
		type ISOTimeString
	} from '@astryx-sv/core';

	// ── Data ──────────────────────────────────────────────────────────────────────

	const STEPS = ['Report', 'Schedule', 'Delivery'];

	const DATASETS = [
		{ value: 'pipeline', label: 'Sales pipeline' },
		{ value: 'revenue', label: 'Revenue and bookings' },
		{ value: 'churn', label: 'Churn and retention' },
		{ value: 'support', label: 'Support tickets' },
		{ value: 'usage', label: 'Product usage' }
	];

	const SECTIONS = [
		{
			value: 'summary',
			label: 'Executive summary',
			description: 'Headline numbers and week-over-week change.'
		},
		{
			value: 'charts',
			label: 'Trend charts',
			description: 'Twelve-week series for each headline metric.'
		},
		{
			value: 'breakdown',
			label: 'Segment breakdown',
			description: 'Split by region, plan, and account size.'
		},
		{
			value: 'anomalies',
			label: 'Anomaly callouts',
			description: 'Metrics more than two standard deviations off trend.'
		}
	];

	const RECIPIENTS = [
		{ value: 'exec', label: 'exec-staff@northwind.dev' },
		{ value: 'sales', label: 'Sales leadership (9 people)' },
		{ value: 'finance', label: 'finance@northwind.dev' },
		{ value: 'amara', label: 'Amara Diallo' },
		{ value: 'felix', label: 'Felix Tran' }
	];

	const TIMEZONES = [
		{ value: 'pt', label: 'Pacific Time (PT)' },
		{ value: 'et', label: 'Eastern Time (ET)' },
		{ value: 'gmt', label: 'Greenwich Mean Time (GMT)' },
		{ value: 'cet', label: 'Central European Time (CET)' }
	];

	const WEEKDAYS = [
		{ value: 'mon', label: 'Monday' },
		{ value: 'tue', label: 'Tuesday' },
		{ value: 'wed', label: 'Wednesday' },
		{ value: 'thu', label: 'Thursday' },
		{ value: 'fri', label: 'Friday' }
	];

	// ── Helpers ───────────────────────────────────────────────────────────────────

	// The footer summarises rather than quoting a field's message, so a blocked
	// step never shows the same sentence in two places.

	const blockedMessage = (count: number) =>
		count === 1
			? 'One problem above needs fixing first.'
			: `${count} problems above need fixing first.`;

	const showToast = useToast();

	// The cadence control is a radiogroup, so its Field needs both: `inputID`
	// because Field requires one, and `labelID` because that is the id the group
	// points back at to take the visible label as its name.
	const cadenceID = $props.id();
	const cadenceInputID = cadenceID;
	const cadenceLabelID = `${cadenceID}-label`;

	let step = $state(0);
	let attempted = $state<ReadonlySet<number>>(new Set());

	let name = $state('');
	let dataset = $state('pipeline');
	let sections = $state<string[]>(['summary', 'charts']);
	let note = $state('');

	let cadence = $state('weekly');
	let weekday = $state('mon');
	let time = $state<ISOTimeString | undefined>('08:00' as ISOTimeString);
	let timezone = $state('pt');
	let startDate = $state<ISODateString | undefined>();

	let recipients = $state<string[]>(['exec']);
	let format = $state('pdf');
	let skipEmpty = $state(true);

	// Upstream's `useState` setters. Named here so every call site below reads
	// the same as the JSX it was transcribed from.
	const setName = (value: string) => (name = value);
	const setDataset = (value: string) => (dataset = value);
	const setSections = (value: string[]) => (sections = value);
	const setNote = (value: string) => (note = value);
	const setCadence = (value: string) => (cadence = value);
	const setWeekday = (value: string) => (weekday = value);
	const setTime = (value: ISOTimeString | undefined) => (time = value);
	const setTimezone = (value: string) => (timezone = value);
	const setStartDate = (value: ISODateString | undefined) => (startDate = value);
	const setRecipients = (value: string[]) => (recipients = value);
	const setFormat = (value: string) => (format = value);
	const setSkipEmpty = (value: boolean) => (skipEmpty = value);

	const resetDraft = () => {
		step = 0;
		attempted = new Set();
		name = '';
		dataset = 'pipeline';
		sections = ['summary', 'charts'];
		note = '';
		cadence = 'weekly';
		weekday = 'mon';
		time = '08:00' as ISOTimeString;
		timezone = 'pt';
		startDate = undefined;
		recipients = ['exec'];
		format = 'pdf';
		skipEmpty = true;
	};

	// The inline preview cannot actually disappear, but it still exercises the
	// same close request a real modal receives from Escape or its close button.
	// When promoted to a modal, update this handler to set the owning `isOpen`
	// state after the reset rather than replacing it with the raw setter.
	const handleOpenChange = (isOpen: boolean) => {
		if (!isOpen) {
			resetDraft();
		}
	};

	const errorsByStep = $derived<Array<Record<string, string>>>([
		{
			...(name.trim() ? {} : { name: 'Give the report a name.' }),
			...(sections.length === 0 ? { sections: 'Include at least one section.' } : {})
		},
		{
			...(time ? {} : { time: 'Pick a send time.' }),
			...(startDate ? {} : { startDate: 'Pick a start date.' })
		},
		{
			...(recipients.length === 0 ? { recipients: 'Add at least one recipient.' } : {})
		}
	]);

	const shownErrors = (index: number) => (attempted.has(index) ? errorsByStep[index] : {});
	const currentErrors = $derived(shownErrors(step));
	const isLastStep = $derived(step === STEPS.length - 1);

	const cadenceSummary = $derived(
		cadence === 'daily'
			? `Every weekday at ${time ?? '—'}`
			: cadence === 'weekly'
				? `${WEEKDAYS.find((d) => d.value === weekday)?.label ?? weekday}s at ${time ?? '—'}`
				: `1st of the month at ${time ?? '—'}`
	);

	const goNext = () => {
		attempted = new Set(attempted).add(step);
		if (Object.keys(errorsByStep[step]).length !== 0) {
			return;
		}
		if (!isLastStep) {
			step = step + 1;
			return;
		}
		// A modal would close here, and closing is most of the confirmation: the
		// list behind it gains a row. With nothing to close, the toast carries
		// that news on its own, and the draft resets so the next run starts clean
		// rather than resuming a flow that already finished.
		showToast({
			body: `${name.trim()} is scheduled · ${cadenceSummary}`,
			uniqueID: 'report-scheduled'
		});
		resetDraft();
	};
</script>

{#snippet header()}
	<!--
		Two header rows, both pinned: the title, then the stepper. The dialog body
		scrolls against maxHeight, so a stepper placed in the body would slide out
		of view on the longest step — the one where knowing your position matters
		most. Neither row draws a rule, so the two read as one header block rather
		than a stack of bars in a 620px-wide dialog.
	-->
	<DialogHeader title="Schedule a report" onOpenChange={handleOpenChange} hasDivider={false} />
	<LayoutHeader hasDivider={false}>
		<!--
			Compact, no descriptions, no click-to-jump: at this width the stepper is
			a position indicator, and the two footer buttons are the whole
			navigation model.
		-->
		<Stepper
			activeStep={step}
			orientation="horizontal"
			density="compact"
			label="Report setup progress"
		>
			{#each STEPS as label, i (label)}
				<Step
					step={i}
					{label}
					status={Object.keys(shownErrors(i)).length > 0 ? 'error' : undefined}
				/>
			{/each}
		</Stepper>
	</LayoutHeader>
{/snippet}

{#snippet content()}
	<LayoutContent>
		<VStack gap={5}>
			{#if step === 0}
				<!--
					One optionality convention across all three steps: unmarked means
					optional, so only the fields that block the next button carry an
					indicator. In a dialog this matters more than on a page — there is
					no room for a legend explaining what the badges mean.
				-->
				<FormLayout defaultOptionality="optional">
					<TextInput
						label="Report name"
						isRequired
						value={name}
						onChange={setName}
						placeholder="Weekly pipeline review"
						description="Used as the email subject line."
						status={currentErrors.name
							? { type: 'error', message: currentErrors.name }
							: undefined}
					/>
					<Selector label="Dataset" options={DATASETS} value={dataset} onChange={setDataset} />
					<CheckboxList
						label="Sections to include"
						value={sections}
						onChange={setSections}
						density="compact"
						status={currentErrors.sections
							? { type: 'error', message: currentErrors.sections }
							: undefined}
					>
						{#each SECTIONS as section (section.value)}
							<CheckboxListItem
								value={section.value}
								label={section.label}
								description={section.description}
							/>
						{/each}
					</CheckboxList>
				</FormLayout>
			{/if}

			{#if step === 1}
				<FormLayout defaultOptionality="optional">
					<!--
						SegmentedControl's own label never renders — it is the aria-label.
						Field gives it a visible one that starts on the same line as the
						fields below.

						A radiogroup is named by `labelID` + `aria-labelledby`, not by
						`htmlFor`: `isGroupLabel` renders the label as a span, and a span
						has no control to point at. That makes the group's name the label
						the user can actually see, rather than a second string that happens
						to match.
					-->
					<Field
						label="How often"
						inputID={cadenceInputID}
						labelID={cadenceLabelID}
						isGroupLabel
					>
						<SegmentedControl
							label="How often"
							aria-labelledby={cadenceLabelID}
							value={cadence}
							onChange={setCadence}
							layout="fill"
						>
							<SegmentedControlItem value="daily" label="Weekdays" />
							<SegmentedControlItem value="weekly" label="Weekly" />
							<SegmentedControlItem value="monthly" label="Monthly" />
						</SegmentedControl>
					</Field>
					{#if cadence === 'weekly'}
						<Selector
							label="Day of the week"
							options={WEEKDAYS}
							value={weekday}
							onChange={setWeekday}
						/>
					{/if}
					<!--
						Always horizontal: a dialog sets its own width, so unlike the
						full-page wizards this pair has no narrow case to fall back from.
					-->
					<FormLayout direction="horizontal" defaultOptionality="optional">
						<TimeInput
							label="Send at"
							isRequired
							value={time}
							onChange={setTime}
							status={currentErrors.time
								? { type: 'error', message: currentErrors.time }
								: undefined}
						/>
						<Selector
							label="Time zone"
							options={TIMEZONES}
							value={timezone}
							onChange={setTimezone}
						/>
					</FormLayout>
					<DateInput
						label="First run"
						isRequired
						value={startDate}
						onChange={setStartDate}
						status={currentErrors.startDate
							? { type: 'error', message: currentErrors.startDate }
							: undefined}
					/>
					<Banner
						status="info"
						title={cadenceSummary}
						description="Data is cut at the send time, so a report at 08:00 covers everything up to 08:00."
					/>
				</FormLayout>
			{/if}

			{#if step === 2}
				<FormLayout defaultOptionality="optional">
					<MultiSelector
						label="Recipients"
						isRequired
						options={RECIPIENTS}
						value={recipients}
						onChange={setRecipients}
						hasSearch
						triggerDisplay="badges"
						description="Groups resolve at send time, so new members are included automatically."
						status={currentErrors.recipients
							? { type: 'error', message: currentErrors.recipients }
							: undefined}
					/>
					<RadioList label="Attachment format" value={format} onChange={setFormat} size="sm">
						<RadioListItem
							value="pdf"
							label="PDF"
							description="Best for reading. Charts render as images."
						/>
						<RadioListItem
							value="csv"
							label="CSV"
							description="Raw rows, no charts or summary."
						/>
						<RadioListItem value="both" label="Both" description="PDF in the body, CSV attached." />
					</RadioList>
					<Switch
						label="Skip the send when there is no new data"
						value={skipEmpty}
						onChange={setSkipEmpty}
						labelPosition="start"
						labelSpacing="spread"
					/>
					<TextArea
						label="Note in the email"
						rows={2}
						maxLength={200}
						value={note}
						onChange={setNote}
						placeholder="Numbers are provisional until finance closes the month."
					/>
					<Divider />
					<MetadataList columns="single">
						<MetadataListItem label="Report">{name.trim() || 'Untitled'}</MetadataListItem>
						<MetadataListItem label="Runs">
							{cadenceSummary}
							{TIMEZONES.find((t) => t.value === timezone)?.label.match(/\(([^)]+)\)/)?.[1] ??
								''}
						</MetadataListItem>
						<MetadataListItem label="Sent to">
							{recipients.length === 0
								? '—'
								: `${recipients.length} ${recipients.length === 1 ? 'recipient' : 'recipients'}`}
						</MetadataListItem>
					</MetadataList>
				</FormLayout>
			{/if}
		</VStack>
	</LayoutContent>
{/snippet}

{#snippet footer()}
	<LayoutFooter>
		<HStack gap={2} vAlign="center">
			<Button
				label="Back"
				variant="secondary"
				isDisabled={step === 0}
				onclick={() => (step = Math.max(0, step - 1))}
			/>
			<!--
				Empty spacer, and the message hugs its text beside the button it
				explains. Inside the fill it would stretch across a footer this narrow
				can't spare.
			-->
			<StackItem size="fill" />
			{#if Object.keys(currentErrors).length > 0}
				<FieldStatus
					type="error"
					variant="detached"
					message={blockedMessage(Object.keys(currentErrors).length)}
				/>
			{/if}
			<Button
				label={isLastStep ? 'Schedule report' : 'Continue'}
				variant="primary"
				onclick={goNext}
			/>
		</HStack>
	</LayoutFooter>
{/snippet}

<!--
	Center is the page root, so the dialog stands in the middle of the space its
	backdrop would have covered.

	`isOpen` is literal and `isInline` is set because, per the module header, this
	page doubles as a gallery tile and a docs preview. Drop `isInline`, and drive
	`isOpen` from the trigger page, to make this a modal.

	`purpose="form"`: a stray backdrop click cannot throw away a part-finished
	flow. Escape and the close button still work.

	The Layout is `height="fill"`, not `auto`: the shell is already bounded by the
	dialog's maxHeight, and an auto Layout sizes to its content and lets the
	overflow be clipped by the dialog rather than scrolled — on the longest step
	that quietly cut the footer buttons off. Its `padding={4}` is the dialog's
	own tighter inset, declared once so the title, the stepper, the fields and
	the two footer buttons share a line.
-->
<Center height="100dvh">
	<Dialog
		isOpen
		isInline
		onOpenChange={handleOpenChange}
		width={620}
		purpose="form"
	>
		<Layout height="fill" padding={4} defaultHasDividers {header} {content} {footer} />
	</Dialog>
</Center>
