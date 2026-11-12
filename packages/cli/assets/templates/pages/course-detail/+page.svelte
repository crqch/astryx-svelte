<!--
	Ported from upstream's `assets/templates/pages/course-detail/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Heroicons, upstream's own set: `@fvilers/heroicons-svelte` is that
	set built for Svelte 5, and it keeps upstream's component names and its
	`24/outline` / `20/solid` / `24/solid` entry points. The imports below are
	upstream's with the package name changed.

	Upstream's `stickyRail` and `posterImage` are `CSSProperties` objects handed
	to `style`; Svelte's `style` prop is a string, so they are the same
	declarations in the same order, under upstream's names.

	`StarRating`, `SectionHeader`, `CourseHead`, `AboutSection`, `SyllabusSection`,
	`InstructorSection`, `ReviewCard`, `ReviewsSection`, `FaqSection` and
	`EnrollRail` are local components upstream; here they are snippets — a page
	template is one file, so `EnrollRail`'s state hoists onto the page (there is
	exactly one instance, so rendering is identical).

	`rtlStyles.mirror` is StyleX, which a `.svelte` file may not import. The
	enroll button's arrow carries a `template-mirror` class and the rule at the
	bottom of this file reproduces upstream's `:is([dir='rtl'] *)` mirror.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		AspectRatio,
		Avatar,
		Badge,
		Button,
		Card,
		Collapsible,
		CollapsibleGroup,
		Divider,
		Grid,
		HStack,
		Heading,
		Icon,
		Layout,
		LayoutContent,
		Link,
		ProgressBar,
		RadioList,
		RadioListItem,
		Section,
		SegmentedControl,
		SegmentedControlItem,
		Slider,
		StackItem,
		Text,
		VStack,
		VisuallyHidden
	} from '@astryx-sv/core';
	import {
		ArrowRightIcon,
		BoltIcon,
		BookOpenIcon,
		CheckIcon,
		ClockIcon,
		GlobeAltIcon,
		PlayIcon,
		StarIcon,
		UsersIcon
	} from '@fvilers/heroicons-svelte/24/outline';
	import { StarIcon as StarIconSolid } from '@fvilers/heroicons-svelte/24/solid';

	// Custom CSS here is limited to what Astryx components can't express today:
	// - image fill + corner radius (no Image primitive — #2582)
	// - the sticky enroll rail (no sticky prop on Astryx layout primitives — #2613)
	const stickyRail = 'position: sticky; top: var(--spacing-8); align-self: start;';
	const posterImage =
		'width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-container);';

	// ─── Data ────────────────────────────────────────────────────────────────────
	const COURSE = {
		title: 'Applied AI: Build with Language Models',
		level: 'Intermediate',
		language: 'English',
		rating: 4.8,
		ratingCount: 1284,
		learnerCount: '12,840',
		lessonCount: 13,
		runtime: '4h 07m',
		price: 89,
		compareAt: 129,
		about:
			'Most courses show you what a model can do. This one makes you build the three features every product team is asked for — retrieval that answers the right question, output you can hand to other code, and an evaluation harness that catches regressions before your users do. Every module ends in something that runs; the reviewed project is a working extraction pipeline you can adapt.',
		skills: [
			'Retrieval-augmented generation',
			'Structured output',
			'Evaluation harnesses',
			'Prompt design',
			'Vector search'
		]
	};

	const MODULES = [
		{
			id: 'foundations',
			title: 'Foundations and tooling',
			meta: '3 lessons · 48 min',
			lessons: [
				{
					title: 'What a language model can and cannot promise',
					duration: '12 min'
				},
				{
					title: 'The working setup: SDK, keys, and a scratchpad',
					duration: '18 min'
				},
				{ title: 'Tokens, temperature, and the cost dial', duration: '18 min' }
			]
		},
		{
			id: 'retrieval',
			title: 'Retrieval that answers the question',
			meta: '4 lessons · 76 min',
			lessons: [
				{
					title: 'Chunking strategies that survive real documents',
					duration: '21 min'
				},
				{ title: 'Vector search from first principles', duration: '19 min' },
				{ title: 'Rerankers and the relevance ceiling', duration: '18 min' },
				{ title: 'When the model should say it found nothing', duration: '18 min' }
			]
		},
		{
			id: 'output',
			title: 'Structured output you can hand to code',
			meta: '3 lessons · 64 min',
			lessons: [
				{ title: 'Schemas as contracts, not suggestions', duration: '22 min' },
				{ title: 'Validation, repair, and retry loops', duration: '21 min' },
				{ title: 'Streaming partial results into a UI', duration: '21 min' }
			]
		},
		{
			id: 'evaluation',
			title: 'The evaluation harness',
			meta: '3 lessons · 59 min',
			lessons: [
				{ title: 'Golden sets and where they come from', duration: '20 min' },
				{ title: 'Scoring retrieval and generation apart', duration: '19 min' },
				{ title: 'Regression gates in continuous integration', duration: '20 min' }
			]
		}
	];

	const INCLUDES = [
		'Lifetime access to 13 lessons and all future revisions',
		'The reviewed project: a working extraction pipeline',
		'A graded certificate of completion',
		'Offline downloads for every lesson'
	];

	const INSTRUCTOR = {
		name: 'Gabriela Fernández',
		role: 'Applied AI engineer, formerly search infrastructure',
		portrait: 'https://lookaside.facebook.com/assets/astryx/DATA-Gabriela-Fernandez.png',
		learners: '12,840',
		courses: '4',
		rating: '4.9',
		bio: 'Gabriela spent nine years building retrieval systems at scale before language models landed on her desk. She has shipped the exact pipeline this course teaches — twice, in production, with the scars to prove which parts matter.'
	};

	const ASPECTS = [
		{ label: 'Content depth', score: 4.9 },
		{ label: 'Practical exercises', score: 4.8 },
		{ label: 'Instructor clarity', score: 4.9 },
		{ label: 'Pacing', score: 4.6 },
		{ label: 'Materials and project', score: 4.7 },
		{ label: 'Community support', score: 4.5 }
	];

	const REVIEWS = [
		{
			name: 'Drew Young',
			avatar: 'https://lookaside.facebook.com/assets/astryx/DATA-Drew-Young.png',
			date: 'Reviewed 2 weeks ago',
			rating: 5,
			body: 'The evaluation module alone is worth the price. I walked in with a half-working RAG demo and walked out with a harness that caught two regressions in our first sprint after launch.',
			helpful: 41
		},
		{
			name: 'Jihoo Song',
			avatar: 'https://lookaside.facebook.com/assets/astryx/DATA-Jihoo-Song.png',
			date: 'Reviewed a month ago',
			rating: 5,
			body: 'Gabriela explains rerankers better than the papers do. The chunking lesson changed how our team splits documentation, and the project review was concrete, not rubber-stamp.',
			helpful: 28
		},
		{
			name: 'Ana Thomas',
			avatar: 'https://lookaside.facebook.com/assets/astryx/DATA-Ana-Thomas.png',
			date: 'Reviewed 2 months ago',
			rating: 4,
			body: 'Dense but fair. I wanted more on fine-tuning and got none — the course is honest about scoping to what ships. The structured-output lessons replaced three fragile regex pipelines of mine.',
			helpful: 19
		},
		{
			name: 'Pablo Morales',
			avatar: 'https://lookaside.facebook.com/assets/astryx/DATA-Pablo-Morales.png',
			date: 'Reviewed 3 months ago',
			rating: 5,
			body: 'I have taken four applied-AI courses this year and finished one. This is the one. Every module ends in something that runs, exactly as promised, and the finish-date picker kept me honest about pacing.',
			helpful: 33
		}
	];

	const FAQS = [
		{
			q: 'Do I need production access to a language model?',
			a: 'No. Every exercise runs on a free-tier API key, and the project review accepts either the free tier or a local model. The course states where results differ between them.'
		},
		{
			q: 'How long do I have access?',
			a: 'Access is lifetime, including every future revision of the lessons. When the tooling shifts — and it will — the affected lessons are re-recorded rather than patched with errata.'
		},
		{
			q: 'What if the course is not right for me?',
			a: 'Every purchase carries a 30-day money-back guarantee, no questions and no forms beyond one click. Certificates already issued are yours to keep.'
		},
		{
			q: 'Is there a certificate?',
			a: 'Yes — a graded certificate issued when the reviewed project passes. It lists the pipeline you built, not just attendance.'
		}
	];

	const COHORTS = [
		{
			id: 'march',
			date: 'Cohort of March 10',
			detail: 'Live reviews · 14 seats left'
		},
		{
			id: 'april',
			date: 'Cohort of April 7',
			detail: 'Live reviews · 6 seats left'
		}
	];

	// A fixed reference date keeps the computed finish date deterministic
	// between server and client render.
	const COHORT_START = new Date('2026-03-02T00:00:00');
	const TOTAL_HOURS = 42;
	const PACE_MIN = 2;
	const PACE_MAX = 12;

	const fmt = (n: number) => `$${n.toFixed(0)}`;

	const finishFrom = (pace: number) => {
		const weeks = Math.max(1, Math.ceil(TOTAL_HOURS / pace));
		const finish = new Date(COHORT_START);
		finish.setDate(finish.getDate() + weeks * 7);
		return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} · finish around ${finish.toLocaleDateString(
			'en-US',
			{ month: 'short', day: 'numeric' }
		)}`;
	};

	let mode = $state('self-paced');
	let pace = $state(7);
	let cohort = $state(COHORTS[0].id);
</script>

<!-- ─── Star Rating ───────────────────────────────────────────────────────────── -->
{#snippet starRating(rating: number, count?: number)}
	{@const filled = Math.round(rating)}
	{@const empty = 5 - filled}
	<HStack gap={1} vAlign="center">
		{#each Array.from({ length: filled }, (_, i) => i) as i (i)}
			<Icon icon={StarIconSolid} size="sm" />
		{/each}
		{#each Array.from({ length: empty }, (_, i) => i) as i (`empty-${i}`)}
			<Icon icon={StarIcon} size="sm" />
		{/each}
		{#if count === undefined}
			<VisuallyHidden>{`Rated ${rating} out of 5`}</VisuallyHidden>
		{/if}
		{#if count !== undefined}
			<Text type="body" color="secondary">{rating} ({count.toLocaleString('en-US')})</Text>
		{/if}
	</HStack>
{/snippet}

{#snippet sectionHeader(title: string, action?: Snippet)}
	<HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
		<Heading level={2}>{title}</Heading>
		{#if action}{@render action()}{/if}
	</HStack>
{/snippet}

<!-- ─── Course head: title, poster, facts ─────────────────────────────────────── -->
{#snippet courseHead()}
	<VStack gap={4}>
		<VStack gap={2}>
			<HStack gap={2} vAlign="center">
				<Badge variant="warning" label="Bestseller" />
				<Badge label={COURSE.level} />
			</HStack>
			<Heading level={1} maxLines={3}>{COURSE.title}</Heading>
			<HStack gap={2} vAlign="center">
				{@render starRating(COURSE.rating, COURSE.ratingCount)}
				<Text type="body" color="secondary">· {COURSE.learnerCount} learners</Text>
			</HStack>
		</VStack>
		<AspectRatio ratio={16 / 9}>
			<img
				style={posterImage}
				src="https://lookaside.facebook.com/assets/astryx/light-working-horizontal-1.png"
				alt="Course preview: a laptop showing the extraction pipeline built in the project"
			/>
		</AspectRatio>
		<HStack gap={5} vAlign="center" wrap="wrap">
			<HStack gap={1} vAlign="center">
				<Icon icon={ClockIcon} size="sm" />
				<Text type="body" color="secondary">{COURSE.runtime}</Text>
			</HStack>
			<HStack gap={1} vAlign="center">
				<Icon icon={BookOpenIcon} size="sm" />
				<Text type="body" color="secondary">{COURSE.lessonCount} lessons</Text>
			</HStack>
			<HStack gap={1} vAlign="center">
				<Icon icon={GlobeAltIcon} size="sm" />
				<Text type="body" color="secondary">{COURSE.language}</Text>
			</HStack>
			<HStack gap={1} vAlign="center">
				<Icon icon={BoltIcon} size="sm" />
				<Text type="body" color="secondary">Self-paced or cohort</Text>
			</HStack>
		</HStack>
	</VStack>
{/snippet}

<!-- ─── About ─────────────────────────────────────────────────────────────────── -->
{#snippet aboutSection()}
	<Section padding={6}>
		<VStack gap={4}>
			{@render sectionHeader('About this course')}
			<Text type="body">{COURSE.about}</Text>
			<VStack gap={2}>
				<Text type="label">Skills you practice</Text>
				<HStack gap={2} wrap="wrap">
					{#each COURSE.skills as skill (skill)}
						<Badge label={skill} />
					{/each}
				</HStack>
			</VStack>
		</VStack>
	</Section>
{/snippet}

<!-- ─── Syllabus ──────────────────────────────────────────────────────────────── -->
{#snippet syllabusMeta()}
	<Text type="supporting" color="secondary">
		{MODULES.length} modules · {COURSE.lessonCount} lessons
	</Text>
{/snippet}

{#snippet syllabusSection()}
	<Section padding={6}>
		<VStack gap={4}>
			{@render sectionHeader('Syllabus', syllabusMeta)}
			<CollapsibleGroup type="multiple" defaultValue={[MODULES[0].id]}>
				{#each MODULES as module (module.id)}
					{#snippet moduleTrigger()}
						<VStack gap={1}>
							<Text type="large" weight="bold">{module.title}</Text>
							<Text type="supporting" color="secondary">{module.meta}</Text>
						</VStack>
					{/snippet}
					<Collapsible value={module.id} trigger={moduleTrigger}>
						<VStack gap={2}>
							{#each module.lessons as lesson (lesson.title)}
								<HStack gap={2} vAlign="center" hAlign="between">
									<HStack gap={2} vAlign="center">
										<Icon icon={PlayIcon} size="sm" />
										<Text type="body">{lesson.title}</Text>
									</HStack>
									<Text type="supporting" color="secondary">{lesson.duration}</Text>
								</HStack>
							{/each}
						</VStack>
					</Collapsible>
				{/each}
			</CollapsibleGroup>
		</VStack>
	</Section>
{/snippet}

<!-- ─── Instructor ────────────────────────────────────────────────────────────── -->
{#snippet instructorSection()}
	<Section padding={6}>
		<VStack gap={4}>
			{@render sectionHeader('Your instructor')}
			<Card padding={5}>
				<VStack gap={4}>
					<HStack gap={4} vAlign="start">
						<Avatar name={INSTRUCTOR.name} src={INSTRUCTOR.portrait} size="xl" />
						<VStack gap={1}>
							<Text type="large" weight="bold">{INSTRUCTOR.name}</Text>
							<Text type="body" color="secondary">{INSTRUCTOR.role}</Text>
						</VStack>
					</HStack>
					<HStack gap={5} vAlign="center">
						<HStack gap={1} vAlign="center">
							<Icon icon={UsersIcon} size="sm" />
							<Text type="body" color="secondary">{INSTRUCTOR.learners} learners</Text>
						</HStack>
						<HStack gap={1} vAlign="center">
							<Icon icon={BookOpenIcon} size="sm" />
							<Text type="body" color="secondary">{INSTRUCTOR.courses} courses</Text>
						</HStack>
						<HStack gap={1} vAlign="center">
							<Icon icon={StarIcon} size="sm" />
							<Text type="body" color="secondary">{INSTRUCTOR.rating} instructor rating</Text>
						</HStack>
					</HStack>
					<Text type="body">{INSTRUCTOR.bio}</Text>
					<HStack gap={2}>
						<Button label="View full profile" />
						<Button label="Follow" variant="ghost" />
					</HStack>
				</VStack>
			</Card>
		</VStack>
	</Section>
{/snippet}

<!-- ─── Reviews ───────────────────────────────────────────────────────────────── -->
{#snippet reviewCard(review: (typeof REVIEWS)[number])}
	<Card padding={4}>
		<VStack gap={3}>
			<HStack gap={2} vAlign="center">
				<Avatar name={review.name} src={review.avatar} size="sm" />
				<VStack gap={1}>
					<Text type="body" weight="bold">{review.name}</Text>
					<Text type="supporting" color="secondary">{review.date}</Text>
				</VStack>
			</HStack>
			{@render starRating(review.rating)}
			<Text type="body">{review.body}</Text>
			<HStack gap={2} vAlign="center">
				<Button
					label={`Helpful (${review.helpful})`}
					variant="ghost"
					size="sm"
					icon={helpfulIcon}
				/>
			</HStack>
		</VStack>
	</Card>
{/snippet}

{#snippet helpfulIcon()}
	<Icon icon={CheckIcon} size="xsm" />
{/snippet}

{#snippet reviewsSection()}
	<Section padding={6}>
		<VStack gap={4}>
			{@render sectionHeader('Reviews', reviewsLink)}
			<Card padding={5}>
				<VStack gap={4}>
					<HStack gap={5} vAlign="center">
						<VStack gap={1}>
							<Text type="display-3">{COURSE.rating}</Text>
							{@render starRating(COURSE.rating)}
							<Text type="supporting" color="secondary">
								{COURSE.ratingCount.toLocaleString('en-US')} reviews
							</Text>
						</VStack>
						<StackItem size="fill">
							<VStack gap={3}>
								{#each ASPECTS as aspect (aspect.label)}
									<VStack gap={1}>
										<HStack gap={2} vAlign="center" hAlign="between">
											<Text type="body" color="secondary">{aspect.label}</Text>
											<Text type="body" color="secondary">
												{aspect.score.toFixed(1)}
											</Text>
										</HStack>
										<ProgressBar
											label={aspect.label}
											isLabelHidden
											value={(aspect.score / 5) * 100}
										/>
									</VStack>
								{/each}
							</VStack>
						</StackItem>
					</HStack>
				</VStack>
			</Card>
			<Grid columns={{ minWidth: 280, repeat: 'fit' }} gap={4}>
				{#each REVIEWS as review (review.name)}
					{@render reviewCard(review)}
				{/each}
			</Grid>
		</VStack>
	</Section>
{/snippet}

{#snippet reviewsLink()}
	<Link href="#" type="supporting" color="secondary">How reviews work</Link>
{/snippet}

<!-- ─── FAQ ───────────────────────────────────────────────────────────────────── -->
{#snippet faqSection()}
	<Section padding={6}>
		<VStack gap={4}>
			{@render sectionHeader('Common questions')}
			<CollapsibleGroup type="multiple">
				{#each FAQS as faq (faq.q)}
					{#snippet faqTrigger()}
						<Text type="large" weight="bold">{faq.q}</Text>
					{/snippet}
					<Collapsible value={faq.q} defaultIsOpen={false} trigger={faqTrigger}>
						<Text type="body">{faq.a}</Text>
					</Collapsible>
				{/each}
			</CollapsibleGroup>
		</VStack>
	</Section>
{/snippet}

<!-- ─── Enroll rail ───────────────────────────────────────────────────────────── -->
{#snippet enrollIcon()}
	<Icon icon={ArrowRightIcon} size="sm" class="template-mirror" />
{/snippet}

{#snippet playIcon()}
	<Icon icon={PlayIcon} size="sm" />
{/snippet}

{#snippet enrollRail()}
	<Card padding={5}>
		<VStack gap={4}>
			<VStack gap={1}>
				<HStack gap={2} vAlign="center">
					<Text type="display-3">{fmt(COURSE.price)}</Text>
					<Text type="body" color="secondary" hasStrikethrough>{fmt(COURSE.compareAt)}</Text>
					<Badge variant="error" label="Sale" />
				</HStack>
				<Text type="supporting" color="secondary">One-time purchase · yours to keep</Text>
			</VStack>
			<VStack gap={2}>
				<Button
					label="Enroll now"
					variant="primary"
					size="lg"
					icon={enrollIcon}
				/>
				<Button label="Start lesson one free" size="lg" icon={playIcon} />
			</VStack>
			<Text type="supporting" color="secondary">30-day money-back guarantee</Text>
			<Divider />
			<VStack gap={3}>
				<Text type="label">Start</Text>
				<SegmentedControl value={mode} onChange={(value: string) => (mode = value)} label="Start mode">
					<SegmentedControlItem value="self-paced" label="Self-paced" />
					<SegmentedControlItem value="cohort" label="Cohort" />
				</SegmentedControl>
				{#if mode === 'self-paced'}
					<VStack gap={2}>
						<Slider
							label="Weekly pace"
							value={pace}
							onChange={(value: number) => (pace = value)}
							min={PACE_MIN}
							max={PACE_MAX}
							marks={[{ value: PACE_MIN }, { value: PACE_MAX }]}
							formatValue={(value: number) => `${value} h/week`}
						/>
						<Text type="supporting" color="secondary">
							At {pace} h/week — {finishFrom(pace)}
						</Text>
					</VStack>
				{:else}
					<RadioList
						label="Cohort start"
						value={cohort}
						onChange={(value: string) => (cohort = value)}
					>
						{#each COHORTS as option (option.id)}
							<RadioListItem
								value={option.id}
								label={option.date}
								description={option.detail}
							/>
						{/each}
					</RadioList>
				{/if}
			</VStack>
			<Divider />
			<VStack gap={2}>
				<Text type="label">This course includes</Text>
				{#each INCLUDES as item (item)}
					<HStack gap={2} vAlign="start">
						<Icon icon={CheckIcon} size="sm" />
						<Text type="body" color="secondary">{item}</Text>
					</HStack>
				{/each}
			</VStack>
		</VStack>
	</Card>
{/snippet}

<!-- ─── Page ──────────────────────────────────────────────────────────────────── -->
<Layout height="fill" contentWidth={1200}>
	{#snippet content()}
		<LayoutContent padding={6}>
			<Grid columns={{ minWidth: 320, repeat: 'fit' }} gap={6}>
				<VStack gap={4}>
					{@render courseHead()}
					{@render aboutSection()}
					{@render syllabusSection()}
					{@render instructorSection()}
					{@render reviewsSection()}
					{@render faqSection()}
				</VStack>
				<VStack gap={4} style={stickyRail}>
					{@render enrollRail()}
				</VStack>
			</Grid>
		</LayoutContent>
	{/snippet}
</Layout>

<style>
	:global([dir='rtl']) :global(.template-mirror) {
		transform: scaleX(-1);
	}
</style>
