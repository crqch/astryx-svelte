<!--
	Ported from upstream's `assets/templates/pages/table-inbox/page.tsx`.
	Transcribed, not re-authored: the parity rule covers template content too.

	Icons are Heroicons, upstream's own set: `@fvilers/heroicons-svelte` keeps
	upstream's names and entry points. Image paths map from `/template-assets/…`
	to the same files on the CDN the other ported templates use.

	## The translations

	1. **`useContainerReveal` is the ported hook, driven from the row plugin.**
	   Upstream spreads its container props onto the `<tr>`; here
	   `useInboxRows` merges the hook's `{class, style}` into the row's
	   `htmlProps`, and the actions and timestamp wear the content props. The
	   hover-intent dwell (`HOVER_INTENT_MS`) is passed through unchanged.

	2. **`useInboxRows` is a plain plugin object, not a hook.** It reads the
	   page's `openId`, `handleOpen` and the reveal getter, so it is rebuilt with
	   `$derived`; the open row is painted on its **cells** rather than the row
	   (`hasRowHighlight: false` on the selection plugin) because the plugin owns
	   the row background.

	3. **`useSurfaceWidth` is an attachment plus a `ResizeObserver`.** Both
	   regions — the surface and the list — use the same helper, and the first
	   read is `offsetWidth` minus computed inline padding, as upstream's
	   `useLayoutEffect` does, so a scaled preview card reports laid-out width
	   rather than painted width.

	4. **The lightbox is one page-level `useLightbox`.** Upstream creates one per
	   `AttachmentStrip`, but a snippet cannot own state. Clicking any
	   attachment writes that message's media to `lightboxMedia` and opens the
	   layer at the clicked index, which is the same gallery behaviour.

	5. **`ComposeWindow`'s state is page-level.** The composer is a snippet, not
	   a component, so recipients/cc/bcc/subject/body/draft-id live on the page.
	   The draft-fill runs in `$effect.pre`, the counterpart of upstream's
	   `useLayoutEffect`, so a reopened thread's fields are set before paint.

	6. **`Table`'s plugins are a record**, as in `table-tree`. Keys are
	   `{selection, rowStatus, rows, gutter}` (selection is omitted while
	   stacked, exactly upstream).

	7. **`OverflowList` takes data**, not children: the tag cell builds a
	   `{label, color}` array and renders its `item`/`overflowRenderer` snippets.
	   Hidden entries are `OverflowItem<T>` values, so the count's description
	   reads the hidden labels rather than React child keys.

	8. **`BottomSheet` publishes no `padding` prop**, so upstream's `padding={0}`
	   is dropped; the Layout inside still owns the inset it declares.

	9. `rtlStyles.mirror` on the pane's back arrow is the `template-mirror`
	   class plus the RTL rule at the bottom, as in the other ports.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		Avatar,
		Badge,
		BottomSheet,
		Button,
		Collapsible,
		CollapsibleGroup,
		EmptyState,
		HStack,
		Heading,
		Icon,
		IconButton,
		Layout,
		LayoutContent,
		LayoutHeader,
		LayoutPanel,
		LightboxLayer,
		OverflowList,
		ResizeHandle,
		Section,
		StackItem,
		Tab,
		TabList,
		Table,
		Text,
		TextArea,
		TextInput,
		Thumbnail,
		Token,
		Tokenizer,
		Toolbar,
		VStack,
		useContainerReveal,
		useLightbox,
		useMediaQuery,
		useResizable,
		useTableRowStatus,
		useTableSelection,
		useTableSelectionState,
		VisuallyHidden,
		pixel,
		proportional,
		type OverflowItem,
		type SearchableItem,
		type SearchSource,
		type TableColumn,
		type TablePlugin
	} from '@astryx-sv/core';
	import {
		ArchiveBoxIcon,
		ArrowLeftIcon,
		ArrowPathIcon,
		ArrowUturnLeftIcon,
		FaceSmileIcon,
		FolderArrowDownIcon,
		InboxIcon,
		LinkIcon,
		PaperAirplaneIcon,
		PaperClipIcon,
		PencilSquareIcon,
		PhotoIcon,
		TrashIcon,
		UsersIcon,
		XMarkIcon
	} from '@fvilers/heroicons-svelte/24/outline';

	// ============= DATA =============

	type Priority = 'urgent' | 'high' | 'normal';

	/**
	 * Where a thread stands, which is also which tab it appears under.
	 *
	 * A standing, not a filter — that is the whole difference from the scope
	 * switch this replaced. "Unread" and "Assigned to me" were adjectives, true
	 * of a thread at the same time as any other; a thread has exactly one
	 * standing at a time, and moving it out of one puts it in another. That is
	 * what makes tabs the right control and what makes a per-tab count mean
	 * something.
	 *
	 * `'inbox'` is the odd one: as a stored value it means "nothing more
	 * specific has happened to this yet", but as a *tab* it shows the whole
	 * queue. See `inCategory`.
	 */
	type Category = 'inbox' | 'escalations' | 'waiting' | 'resolved';

	interface Attachment {
		id: string;
		name: string;
		src: string;
	}

	/**
	 * One message in a thread.
	 *
	 * The stored `replies` are all earlier messages; the newest one is assembled
	 * from the conversation's own `sender` / `receivedFull` / `body` and
	 * appended at read time. See `threadMessages`.
	 */
	interface ThreadMessage {
		id: string;
		sender: string;
		/**
		 * Required, not optional.
		 *
		 * A thread is the one place a mailbox mixes the people writing in with
		 * the people answering, and the name alone does not say which is which —
		 * an address does, at a glance, before any of the prose is read. Making
		 * it optional meant only the newest message carried one, which drew the
		 * distinction between "newest" and "older" instead.
		 */
		senderEmail: string;
		/**
		 * Absolute rather than relative. A collapsed row is the only place this
		 * message's date appears, so it has to stand on its own.
		 */
		receivedFull: string;
		body: string[];
		attachments?: Attachment[];
	}

	interface Conversation extends Record<string, unknown> {
		id: string;
		sender: string;
		senderEmail: string;
		subject: string;
		preview: string;
		tags: string[];
		/** Short form for the row; the pane shows `receivedFull`. */
		receivedAt: string;
		receivedFull: string;
		isUnread: boolean;
		priority: Priority;
		category: Category;
		assignee: string | null;
		body: string[];
		attachments: Attachment[];
		/**
		 * Earlier messages, oldest first. Optional because most of a triage queue
		 * is single messages.
		 */
		replies?: ThreadMessage[];
	}

	const PRIORITY_COLOR: Record<Priority, 'red' | 'orange' | 'default'> = {
		urgent: 'red',
		high: 'orange',
		normal: 'default'
	};

	const PRIORITY_LABEL: Record<Priority, string> = {
		urgent: 'Urgent',
		high: 'High',
		normal: 'Normal'
	};

	const ASSET = 'https://lookaside.facebook.com/assets/astryx';

	const CONVERSATIONS: Conversation[] = [
		{
			id: 'c-01',
			category: 'escalations',
			sender: 'Priya Raman',
			senderEmail: 'priya.raman@northwind.example',
			subject: 'Checkout returns 502 for EU customers',
			preview:
				'Started around 09:40 UTC. Roughly one in five card payments fails at the confirm step…',
			tags: ['Billing', 'Escalated'],
			receivedAt: '9:52 AM',
			receivedFull: 'Today at 9:52 AM',
			isUnread: true,
			priority: 'urgent',
			assignee: null,
			body: [
				'Started around 09:40 UTC. Roughly one in five card payments fails at the confirm step, and only for customers billing to an EU address — US and APAC look untouched.',
				'The response is a bare 502 with no body, so our retry logic treats it as transient and re-submits. Two customers have now been charged twice.',
				'I have paused the retry worker as a stopgap, so the double charges should stop, but the underlying failures have not.'
			],
			attachments: [
				{
					id: 'c-01-a1',
					name: 'northwind-checkout-eu.png',
					src: `${ASSET}/light-home-horizontal-1.png`
				}
			],
			replies: [
				{
					id: 'c-01-r1',
					sender: 'Priya Raman',
					senderEmail: 'priya.raman@northwind.example',
					receivedFull: 'Today at 9:44 AM',
					body: [
						'Flagging early — our payments dashboard has just lit up. No numbers yet, but the failures all look like they are on the confirm step rather than the authorisation.'
					]
				},
				{
					id: 'c-01-r2',
					sender: 'Lucas Meyer',
					// Support-side. Every address on the team shares this domain, which
					// is how a header says "this one is us" without a badge saying so.
					senderEmail: 'lucas.meyer@support.example',
					receivedFull: 'Today at 9:47 AM',
					body: [
						'Acknowledged, paging the payments on-call. Nothing on our status page, so if this is regional it is sitting under our alerting threshold.',
						'Is it specific to one card network, or all of them?'
					]
				}
			]
		},
		{
			id: 'c-02',
			category: 'inbox',
			sender: 'Marcus Feld',
			senderEmail: 'm.feld@harbourpoint.example',
			subject: 'SSO metadata rotation — need new certificate',
			preview:
				'Our IdP certificate expires Friday. Can you confirm the fingerprint before we cut over?',
			tags: ['Identity'],
			receivedAt: '9:31 AM',
			receivedFull: 'Today at 9:31 AM',
			isUnread: true,
			priority: 'high',
			assignee: null,
			body: [
				'Our IdP certificate expires Friday at 23:59 UTC. We have the replacement staged and can publish new metadata whenever you are ready.',
				'Before we cut over, can you confirm the SHA-256 fingerprint you have on file matches the one we published? Last rotation we mismatched and locked out 400 people for an hour.'
			],
			attachments: []
		},
		{
			id: 'c-03',
			category: 'resolved',
			sender: 'Dana Osei',
			senderEmail: 'dana@osei-consulting.example',
			subject: 'Re: Bulk export finished but the file is empty',
			preview:
				'Thanks — re-running with the date filter cleared did produce rows this time.',
			tags: ['Exports'],
			receivedAt: '8:58 AM',
			receivedFull: 'Today at 8:58 AM',
			isUnread: true,
			priority: 'normal',
			assignee: 'You',
			body: [
				'Thanks — re-running with the date filter cleared did produce rows this time, so it looks like the filter was the culprit rather than the export itself.',
				'Worth noting the empty file still came back with a 200 and a success banner, which is what sent me down the wrong path. A warning when an export matches zero records would have saved a morning.'
			],
			attachments: [],
			replies: [
				{
					id: 'c-03-r1',
					sender: 'Dana Osei',
					senderEmail: 'dana@osei-consulting.example',
					receivedFull: 'Yesterday at 5:12 PM',
					body: [
						'Ran the full-account export this afternoon. It finished in about forty seconds and handed me a zero-byte CSV — no header row, nothing.'
					]
				},
				{
					id: 'c-03-r2',
					sender: 'Marta Nowak',
					senderEmail: 'marta.nowak@support.example',
					receivedFull: 'Today at 8:31 AM',
					body: [
						'A zero-byte file usually means the query matched no rows rather than that the export itself failed. Could you retry with the date filter cleared and tell me whether the file comes back with content?'
					]
				}
			]
		},
		{
			id: 'c-04',
			category: 'inbox',
			sender: 'Tomás Ibarra',
			senderEmail: 'tomas.ibarra@meridian.example',
			subject: 'Webhook retries stopped after the 3rd attempt',
			preview:
				'We expected five retries with backoff. Logs show three and then nothing for order 88214.',
			tags: ['Webhooks', 'Bug'],
			receivedAt: '8:14 AM',
			receivedFull: 'Today at 8:14 AM',
			isUnread: false,
			priority: 'high',
			assignee: 'You',
			body: [
				'We expected five retries with exponential backoff. Logs show three attempts and then nothing for order 88214.',
				'The endpoint was returning 503 throughout, so this should have kept retrying to the documented limit. The gap in our delivery log after 08:02 is the part I cannot explain.'
			],
			attachments: []
		},
		{
			id: 'c-05',
			category: 'waiting',
			sender: 'Hannah Lindqvist',
			senderEmail: 'h.lindqvist@varda.example',
			subject: 'Homepage refresh — three directions for your review',
			preview:
				'Attached the three we shortlisted. We need a decision by Thursday to hold the schedule.',
			tags: ['Design', 'Review'],
			receivedAt: 'Yesterday',
			receivedFull: 'Yesterday at 4:22 PM',
			isUnread: false,
			priority: 'high',
			assignee: null,
			body: [
				'Attached the three directions we shortlisted out of the eleven we explored. They differ in mood rather than structure, so the layout work carries over whichever one you pick.',
				'Colourful is the boldest and the furthest from the current site. Light is the safest and reads closest to the product itself. Moody photographs best but needs art direction we do not have in-house yet.',
				'We need a decision by Thursday to hold the build schedule.'
			],
			attachments: [
				{
					id: 'a-1',
					name: 'direction-1-colourful.png',
					src: `${ASSET}/colorful-home-horizontal-1.png`
				},
				{
					id: 'a-2',
					name: 'direction-2-light.png',
					src: `${ASSET}/light-home-horizontal-1.png`
				},
				{
					id: 'a-3',
					name: 'direction-3-moody.png',
					src: `${ASSET}/moody-home-horizontal-1.png`
				}
			],
			replies: [
				{
					id: 'c-05-r1',
					sender: 'Hannah Lindqvist',
					senderEmail: 'h.lindqvist@varda.example',
					receivedFull: 'Monday at 3:05 PM',
					body: [
						'Kicking off the homepage refresh. We have eleven explorations open; I will cut them to three before Thursday so you get something decidable rather than a mood board.'
					]
				},
				{
					id: 'c-05-r2',
					sender: 'Elliot Nakamura',
					senderEmail: 'elliot.nakamura@support.example',
					receivedFull: 'Tuesday at 10:18 AM',
					body: [
						'Three is the right number. One request: hold the hero structure identical across all of them, so the thing we are judging is treatment and not layout. Last round nobody could tell which of the two they were reacting to.'
					]
				},
				{
					// A second voice from the customer's side, and the only one in the
					// fixture. Every other thread is one customer and one agent, where
					// Reply and Reply all address the same person and the difference
					// between the two buttons never shows.
					id: 'c-05-r2b',
					sender: 'Ines Duarte',
					senderEmail: 'i.duarte@varda.example',
					receivedFull: 'Tuesday at 4:52 PM',
					body: [
						'Copy is written against the current hero, so holding the structure suits us — I will only need to reflow if the headline slot changes length.'
					]
				},
				{
					id: 'c-05-r3',
					sender: 'Hannah Lindqvist',
					senderEmail: 'h.lindqvist@varda.example',
					receivedFull: 'Yesterday at 11:40 AM',
					body: [
						'Structure is fixed across all three. Sending the moody direction on its own first — it is the one most likely to split the room, and it reads differently without the other two beside it.'
					],
					attachments: [
						{
							id: 'c-05-r3-a1',
							name: 'moody-direction-hero.png',
							src: `${ASSET}/moody-home-horizontal-1.png`
						}
					]
				}
			]
		},
		{
			id: 'c-06',
			category: 'waiting',
			sender: 'Owen Baptiste',
			senderEmail: 'obaptiste@fieldstone.example',
			subject: 'Seat count says 145 but we only provisioned 120',
			preview:
				'Finance flagged the discrepancy on the March invoice. Can we reconcile before the 30th?',
			tags: ['Billing'],
			receivedAt: 'Yesterday',
			receivedFull: 'Yesterday at 11:07 AM',
			isUnread: false,
			priority: 'high',
			assignee: 'You',
			body: [
				'Finance flagged the discrepancy on the March invoice. Our directory shows 120 provisioned seats; the invoice bills 145.',
				'My guess is deactivated accounts are still counted until the end of the billing period, but I cannot find that stated anywhere. Can we reconcile before the 30th?'
			],
			attachments: []
		},
		{
			id: 'c-07',
			category: 'inbox',
			sender: 'Aiko Tanaka',
			senderEmail: 'aiko.tanaka@shorebird.example',
			subject: 'Docs: the rate-limit page contradicts the API response header',
			preview:
				'Page says 600/min, header reports 300/min on our plan. One of them is wrong.',
			tags: ['Docs'],
			receivedAt: 'Yesterday',
			receivedFull: 'Yesterday at 9:15 AM',
			isUnread: false,
			priority: 'normal',
			assignee: null,
			body: [
				'The rate-limit page says 600 requests per minute on Scale. The X-RateLimit-Limit header on our responses reports 300.',
				'One of them is wrong, and we have sized a batch job against the larger number.'
			],
			attachments: []
		},
		{
			id: 'c-08',
			category: 'resolved',
			sender: 'Reuben Cole',
			senderEmail: 'r.cole@atlasgrid.example',
			subject: 'Re: Scheduled maintenance window confirmation',
			preview: 'Confirmed for Sunday 02:00–04:00 UTC. Nothing further needed.',
			tags: ['Ops'],
			receivedAt: 'Mon',
			receivedFull: 'Monday at 2:40 PM',
			isUnread: false,
			priority: 'normal',
			assignee: 'You',
			body: [
				'Confirmed for Sunday 02:00–04:00 UTC. We have notified our on-call and paused the nightly sync for that window.',
				'Nothing further needed from your side.'
			],
			attachments: []
		},
		{
			id: 'c-09',
			category: 'inbox',
			sender: 'Sofia Marchetti',
			senderEmail: 'sofia@marchetti-legal.example',
			subject: 'Feature request: per-workspace retention policy',
			preview:
				'Our legal team needs 30-day retention on one workspace and 400 on another.',
			tags: ['Feature request'],
			receivedAt: 'Mon',
			receivedFull: 'Monday at 10:02 AM',
			isUnread: false,
			priority: 'normal',
			assignee: null,
			body: [
				'Our legal team needs 30-day retention on the client-intake workspace and 400 days on the matter-archive workspace.',
				'Today retention is an account-level setting, so we are stuck applying the longer policy everywhere, which is the opposite of what our counsel wants.'
			],
			attachments: []
		}
	];

	const CATEGORIES: { value: Category; label: string }[] = [
		{ value: 'inbox', label: 'Inbox' },
		{ value: 'escalations', label: 'Escalations' },
		{ value: 'waiting', label: 'Waiting' },
		{ value: 'resolved', label: 'Resolved' }
	];

	/**
	 * Whether a thread belongs under a given tab.
	 *
	 * Inbox is the whole queue rather than a fourth bucket beside the others. A
	 * mailbox whose first screen shows a quarter of its mail reads as an empty
	 * mailbox, and "escalated" or "waiting on the customer" are things that are
	 * true *of* a thread in the inbox, not places it went instead. So Inbox is
	 * the everything view and the other three are cuts through it.
	 *
	 * One predicate rather than an inline filter, because the tab badges have to
	 * count exactly what the tab will show. Two copies of this rule is two
	 * chances for a badge to promise mail the tab does not have.
	 */
	function inCategory(item: Conversation, category: Category): boolean {
		return category === 'inbox' || item.category === category;
	}

	/** Unread per tab, which is what the badges count. */
	function unreadByCategory(): Record<Category, number> {
		const counts: Record<Category, number> = {
			inbox: 0,
			escalations: 0,
			waiting: 0,
			resolved: 0
		};
		for (const item of CONVERSATIONS) {
			if (!item.isUnread) {
				continue;
			}
			for (const { value } of CATEGORIES) {
				if (inCategory(item, value)) {
					counts[value] += 1;
				}
			}
		}
		return counts;
	}

	/**
	 * Dwell before the row actions appear. Without it a cursor travelling down
	 * the list lights up every row it crosses; keyboard focus and touch ignore
	 * it.
	 *
	 * Short enough to read as immediate on a row the pointer stopped on, which
	 * is the ceiling worth spending here: the dwell buys quiet during a sweep,
	 * and the fade that follows it costs its own frames on top, so a gate long
	 * enough to notice separately reads as the row being slow rather than the
	 * list being calm.
	 */
	const HOVER_INTENT_MS = 90;

	/** Matches the wash the selection plugin paints, so both states look native. */
	const OPEN_CELL_STYLE = 'background-color: var(--color-accent-muted);';

	/**
	 * Below this the surface cannot hold a list and a pane side by side at all,
	 * so the pane takes the whole of it and the list comes back when it closes —
	 * the behaviour of every mail client on a phone.
	 *
	 * The surface, not the window. A page template is not always given the
	 * window: dropped into a preview, a split editor or a modal it gets a box,
	 * and asking `matchMedia` how wide the *window* is answers a question nobody
	 * asked. How wide the table then ends up inside that box is a third question
	 * again; see `STACK_ROWS_BELOW`.
	 */
	const SINGLE_SURFACE_BELOW = 900;

	/**
	 * Below this much room *for the table*, the columns stop earning their keep
	 * and the rows stack.
	 *
	 * 560 sits just above what the tabular layout needs to avoid scrolling
	 * sideways — a 28px status gutter, a 36px checkbox, 190px of sender, the
	 * subject's minimum and the trailing column come to roughly 516 — so the swap
	 * happens before the table starts overflowing rather than after.
	 */
	const STACK_ROWS_BELOW = 560;

	/**
	 * Below this much room for the table, tags go.
	 *
	 * They are a fixed 200px, and the subject is what a queue is actually scanned
	 * by, so past this point the tag column is spending a quarter of the table on
	 * the column people read last. Above it there is room for both.
	 *
	 * This is a separate threshold from `STACK_ROWS_BELOW` because losing a
	 * column and abandoning columns altogether are different amounts of damage,
	 * and the width at which each becomes the better trade is different. Between
	 * the two the table is still tabular, just narrower by one.
	 */
	const TIGHTEN_COLUMNS_BELOW = 900;

	/**
	 * What the pane is worth on arrival: two thirds, leaving the list a third.
	 *
	 * A share rather than a pixel width. The list is the index and the pane is
	 * the thing being read, so the ratio between them is the constant — a fixed
	 * 480px list is a third of a 1440px page but well over half of the surface
	 * the docsite gives a preview, where it read as a table with a pane tacked
	 * on.
	 *
	 * A starting position, not a constraint: the handle overrides it immediately,
	 * and `LIST_MIN_WIDTH` outranks it on surfaces too narrow to give the list
	 * its third.
	 */
	const PANE_DEFAULT_SHARE = 2 / 3;

	/**
	 * The narrowest the list may be dragged.
	 *
	 * Enforced as a ceiling on the pane rather than a floor on the list, because
	 * the list is not a sized region — it is whatever `LayoutContent` has left.
	 * At this width rows have long since stacked, so what it protects is a
	 * stacked row that can still name a sender and a subject.
	 */
	const LIST_MIN_WIDTH = 300;

	/**
	 * The narrowest the pane may be dragged — below this the thread is a column
	 * of broken lines and the reply pair stops fitting on one row.
	 */
	const PANE_MIN_WIDTH = 440;

	/**
	 * The tab strip's height, borrowed by the bulk-selection bar that replaces
	 * it.
	 *
	 * The two share a slot, and the whole point of sharing it is that selecting a
	 * row must not move the table. That only holds if the replacement is the same
	 * height as what it replaced, and the strip's height is not something either
	 * row states — it falls out of a `Tab`'s type and padding. So it is measured
	 * once and named here, and the bar is pinned to it rather than left to arrive
	 * at its own height and miss by a few pixels.
	 *
	 * The band inside is shorter than this and centred in it. The strip's height
	 * includes the rule `TabList hasDivider` draws at its bottom edge; the band
	 * has no rule, so the difference shows up as breathing room around it rather
	 * than as a taller row.
	 */
	const SELECTION_BAR_HEIGHT = 37;

	/**
	 * How wide a message is allowed to get, regardless of the pane.
	 *
	 * The pane is resizable and its ceiling is over a thousand pixels, which is
	 * two or three times a comfortable measure — drag it out and the prose starts
	 * running the full width, where the eye loses the start of the next line on
	 * the way back from the end of the last. A cap is the fix, and it applies to
	 * the body block rather than the pane, so the header, the tags and the
	 * thread's own structure still use the width they were given.
	 */
	const MESSAGE_MEASURE = 680;

	/**
	 * Controls that live inside the row but are not the row.
	 *
	 * The row is one big button, so everything nested in it inherits that click
	 * unless something stops it. Guarding centrally rather than hanging
	 * `stopPropagation` on each control is what keeps this true for the next
	 * control somebody adds — and it has to cover the selection checkbox, which
	 * the plugin renders and the template never touches.
	 */
	const INTERACTIVE_WITHIN_ROW =
		'button, input, a, label, [role="checkbox"], [role="button"], [role="menuitem"]';

	function isRowItself(event: { target: EventTarget | null }): boolean {
		return !(event.target as HTMLElement | null)?.closest(INTERACTIVE_WITHIN_ROW);
	}

	// ============= ROW ACTIONS =============

	interface RowAction {
		id: string;
		label: string;
		icon: typeof ArchiveBoxIcon;
	}

	const ROW_ACTIONS: RowAction[] = [
		{ id: 'archive', label: 'Archive', icon: ArchiveBoxIcon },
		{ id: 'move', label: 'Move to folder', icon: FolderArrowDownIcon },
		{ id: 'delete', label: 'Delete', icon: TrashIcon },
		{ id: 'reply', label: 'Reply', icon: ArrowUturnLeftIcon }
	];

	/**
	 * The same actions, minus the one that is not about the thread.
	 *
	 * Archive, move and delete decide where a conversation goes, so they belong
	 * to whichever surface names the conversation — the row on hover, and the
	 * pane's header once it is open. Reply is an answer to a particular message,
	 * so it lives at the end of the thread instead, under the message it answers.
	 */
	const THREAD_ACTIONS: RowAction[] = ROW_ACTIONS.filter((action) => action.id !== 'reply');

	/** The gap between a message's avatar and the name beside it. */
	const THREAD_HEADER_GAP = 3;

	/** Avatar's default rendered size, which the gutter has to match. */
	const AVATAR_SIZE = 36;

	/**
	 * Archive and delete are what a queue is actually triaged with, and two
	 * buttons is all a stacked row can spend on its trailing column before the
	 * subject starts paying for it. Move and reply are one click away in the
	 * pane's toolbar, which renders all four either way.
	 */
	const NARROW_ROW_ACTIONS = ROW_ACTIONS.filter(
		(action) => action.id === 'archive' || action.id === 'delete'
	);

	/** A `size="sm"` IconButton is 28px (`--size-element-sm`); `gap={0.5}` is 2px. */
	function actionsWidth(count: number): number {
		return count * 28 + (count - 1) * 2;
	}

	/** `density="balanced"` insets a table cell by 12px on each inline edge. */
	const CELL_INSET = 24;

	/**
	 * Puts the unread dot on the page's content line.
	 *
	 * Two things have to agree for that to happen, and neither alone is enough.
	 * `LayoutContent`'s padding publishes the inset, and a table's leading cell
	 * takes its start padding from it — that is what a full-bleed table uses to
	 * line its first column up with the prose above it. But the status gutter is
	 * a flat 28px, which was sized against the 8px floor that applies when there
	 * is no inset to read; against a real one the cell's padding leaves the dot
	 * no width at all and it disappears.
	 *
	 * So the column is re-sized here to what its own contents now cost: 16px of
	 * inset, the 8px dot, and the 12px the density puts after every cell. The
	 * plugin's `renderCell` is kept as it is — the dot, its colour and its
	 * tooltip are the plugin's business, and this is only about where the box is.
	 */
	const STATUS_GUTTER_WIDTH = 36;

	/**
	 * The plugin's own column key. Reaching for it is the part of this worth
	 * flagging: it is internal to `useTableRowStatus`, and if it is ever renamed
	 * this quietly stops applying rather than failing.
	 */
	const STATUS_COLUMN_KEY = '__rowStatus';

	const ALIGN_STATUS_GUTTER: TablePlugin<Conversation> = {
		transformColumns: (columns) =>
			columns.map((column) =>
				column.key === STATUS_COLUMN_KEY
					? { ...column, width: pixel(STATUS_GUTTER_WIDTH) }
					: column
			)
	};

	/**
	 * Room for "Yesterday" — the widest `receivedAt` this data produces — plus
	 * the attachment clip and its gap ahead of it.
	 *
	 * Paid on every row, not just the ones carrying an attachment, because a
	 * column is one width. Buying it per-row would mean the date sitting twenty
	 * pixels further left wherever a clip appears, which turns the one edge in
	 * the table you scan straight down into a ragged one.
	 */
	const TIMESTAMP_WIDTH = 76 + 16 + 4;

	/**
	 * How wide the trailing column has to be.
	 *
	 * Overlaid, the actions and the timestamp occupy the same box at different
	 * times, so the column has to fit whichever is wider — sizing it to the
	 * actions alone is what truncates "Yesterday" to "Yesterd…" the moment the
	 * stacked layout drops to two buttons. Side by side they are both on screen
	 * at once and the column pays for the pair plus the gap between them.
	 */
	function trailingWidth(actionCount: number, isSideBySide: boolean): number {
		const actions = actionsWidth(actionCount);
		return isSideBySide
			? actions + 4 + TIMESTAMP_WIDTH + CELL_INSET
			: Math.max(actions, TIMESTAMP_WIDTH) + CELL_INSET;
	}

	/**
	 * The actions take the whole cell the moment they enter flow, which is what
	 * leaves the timestamp with nowhere to be.
	 *
	 * `Stack` has no flex-basis prop and `StackItem` no width, so this pair is
	 * the one thing the composition cannot say for itself. Without it the cell's
	 * slack stays with the timestamp, and a few pixels of it survive underneath
	 * the buttons instead of collapsing to nothing.
	 */
	const ACTIONS_CLAIM_CELL = 'flex-basis: 100%; flex-shrink: 0;';

	/**
	 * Clips whatever the actions squeeze out of the trailing box.
	 *
	 * The date survives being squeezed to zero width because `maxLines` gives it
	 * an overflow rule of its own. The attachment clip beside it has none — it is
	 * a fixed 16px box that paints wherever it lands — so without this it stays
	 * on screen, overlapping the buttons that just took its cell.
	 */
	const HIDE_SQUEEZED_CONTENT = 'overflow: hidden;';

	// ============= READING PANE =============

	/**
	 * The whole thread, oldest first, with the message the row points at last.
	 *
	 * The newest message is not a separate thing rendered under the history — it
	 * is the last item in the same list. A conversation is one sequence, and
	 * rendering its final entry with a different header, its own divider and no
	 * disclosure made the pane read as two components that happened to be
	 * stacked. It is folded in here and pre-expanded instead, so clicking a row
	 * still lands on readable text while every message in the column opens,
	 * closes and lines up the same way.
	 */
	function threadMessages(conversation: Conversation): ThreadMessage[] {
		return [
			...(conversation.replies ?? []),
			{
				id: conversation.id,
				sender: conversation.sender,
				senderEmail: conversation.senderEmail,
				receivedFull: conversation.receivedFull,
				body: conversation.body,
				attachments: conversation.attachments
			}
		];
	}

	// ============= COMPOSER =============

	/**
	 * Everybody the inbox has heard from, offered as recipients.
	 *
	 * `Tokenizer` needs a `SearchSource`, and the file already holds a directory:
	 * nine conversations, each with a name and an address. Inventing a second
	 * cast of contacts would let the To field disagree with the list behind it.
	 */
	const RECIPIENTS: SearchableItem[] = CONVERSATIONS.map((item) => ({
		id: item.senderEmail,
		label: item.sender
	}));

	/**
	 * The team's own domain. Anyone on it is us, and a reply is not addressed to
	 * us — see `replyDraft`.
	 */
	const OUR_DOMAIN = '@support.example';

	/** What the composer opens with when it is opened from somewhere. */
	interface ComposeDraft {
		conversationId: string;
		recipients: SearchableItem[];
		subject: string;
	}

	/**
	 * Turns a thread into the reply to it.
	 *
	 * Reply goes to whoever wrote the newest message. Reply all adds everyone else
	 * who has written in the thread, minus the team's own addresses — including
	 * yourself on a reply-all is the classic mail-client bug, and here the rule
	 * that avoids it is available: internal senders are the ones on `OUR_DOMAIN`.
	 *
	 * `Re:` is added only if it is not already there, which several of these
	 * subjects arrive with. Threads do not need `Re: Re:`.
	 */
	function replyDraft(conversation: Conversation, isReplyAll: boolean): ComposeDraft {
		const author: SearchableItem = {
			id: conversation.senderEmail,
			label: conversation.sender
		};
		const others = (conversation.replies ?? [])
			.filter(
				(message) =>
					!message.senderEmail.endsWith(OUR_DOMAIN) &&
					message.senderEmail !== conversation.senderEmail
			)
			// A thread is a conversation, so the same person is usually in it more
			// than once — and each appearance would otherwise become a token.
			.filter(
				(message, index, all) =>
					all.findIndex((other) => other.senderEmail === message.senderEmail) === index
			)
			.map((message) => ({ id: message.senderEmail, label: message.sender }));

		return {
			conversationId: conversation.id,
			recipients: isReplyAll ? [author, ...others] : [author],
			subject: conversation.subject.startsWith('Re:')
				? conversation.subject
				: `Re: ${conversation.subject}`
		};
	}

	const RECIPIENT_SOURCE: SearchSource = {
		search: (query: string) =>
			RECIPIENTS.filter((person) => person.label.toLowerCase().includes(query.toLowerCase())),
		bootstrap: () => RECIPIENTS
	};

	/**
	 * The formatting row is scaffolding, and nothing behind it works.
	 *
	 * These four buttons establish that the surface is a composer and hold the
	 * place a real editor's controls would occupy. Core ships no rich-text editor,
	 * so the body below is a plain `TextArea` — there is no document model for
	 * bold, a link, or an inline image to act on. They carry no `onclick` on
	 * purpose: a handler that quietly does nothing is a worse lie than a control
	 * that is visibly inert. Replace the `TextArea` first; these become real
	 * afterwards, not before.
	 */
	const COMPOSER_TOOLS: {
		id: string;
		label: string;
		icon: typeof PaperClipIcon;
	}[] = [
		{ id: 'attach', label: 'Attach files', icon: PaperClipIcon },
		{ id: 'link', label: 'Insert link', icon: LinkIcon },
		{ id: 'image', label: 'Insert image', icon: PhotoIcon },
		{ id: 'emoji', label: 'Insert emoji', icon: FaceSmileIcon }
	];

	type TagEntry = { label: string; color?: 'red' | 'orange' | 'default' };

	/** The priority token (unless normal) and the thread's own tags, in order. */
	function tagEntries(item: Conversation): TagEntry[] {
		return [
			...(item.priority === 'normal'
				? []
				: [{ label: PRIORITY_LABEL[item.priority], color: PRIORITY_COLOR[item.priority] }]),
			...item.tags.map((tag) => ({ label: tag }))
		];
	}

	// ============= SURFACE MEASUREMENT =============

	/**
	 * The width of a box, tracked as it changes.
	 *
	 * Every responsive decision below is a question about the box the template
	 * was given and none of them is a question about the window. `@container` is
	 * the right question in the wrong instrument: its answer never leaves CSS,
	 * and what changes here is the column *list*, which only script can do. So
	 * the box is measured instead.
	 *
	 * The first read is synchronous and uses `offsetWidth` minus computed inline
	 * padding, because `getBoundingClientRect` reports the box as *painted* — an
	 * ancestor `transform: scale()` is baked into it — while `ResizeObserver`
	 * reports the box as *laid out*. The template catalog draws every card
	 * through `scale(0.5)`, so mixing the two would open on half the real width
	 * and correct a frame later.
	 */
	function createSurfaceWidth() {
		let width = $state(0);

		const attach = (node: HTMLElement) => {
			const { paddingInlineStart, paddingInlineEnd } = getComputedStyle(node);
			width =
				node.offsetWidth - parseFloat(paddingInlineStart) - parseFloat(paddingInlineEnd);

			const observer = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (entry) {
					width = entry.contentRect.width;
				}
			});
			observer.observe(node);
			return () => observer.disconnect();
		};

		return {
			get width() {
				return width;
			},
			attach
		};
	}
	let category = $state<Category>('inbox');
	/**
	 * Which thread the user has picked — `undefined` until they pick one.
	 *
	 * Three states rather than two, because "nothing is open" and "nothing has
	 * been chosen yet" want different things on screen. A two-pane mail client
	 * that opens onto an empty pane is showing you its layout instead of your
	 * mail, so the unchosen state falls through to the top of the list; but
	 * closing the pane has to actually close it, and with only `string | null`
	 * the close would be indistinguishable from the initial state and the
	 * default would immediately reopen the thread.
	 */
	let chosenId = $state<string | null | undefined>(undefined);
	let isComposeOpen = $state(false);
	/**
	 * What the composer should open filled with, and null once it has been.
	 *
	 * Cleared on close so that reopening with the Compose button finds the
	 * message as it was left rather than being re-addressed from the last thread
	 * replied to. The composer only reads this on a change of identity, so
	 * clearing it does not empty the fields — see its `draft` handling.
	 */
	let composeDraft = $state<ComposeDraft | null>(null);
	let selectedKeys = $state<Set<string>>(new Set());

	// ---- Composer fields (page-level; see the file header) -------------------

	let recipients = $state<SearchableItem[]>([]);
	let cc = $state<SearchableItem[]>([]);
	let bcc = $state<SearchableItem[]>([]);
	let hasCc = $state(false);
	let hasBcc = $state(false);
	let subject = $state('');
	let body = $state('');
	let draftConversationId: string | null = null;

	const startReply = (draft: ComposeDraft) => {
		composeDraft = draft;
		isComposeOpen = true;
	};

	const setComposeOpen = (isOpen: boolean) => {
		isComposeOpen = isOpen;
		if (!isOpen) {
			composeDraft = null;
		}
	};

	const discard = () => {
		recipients = [];
		cc = [];
		bcc = [];
		hasCc = false;
		hasBcc = false;
		subject = '';
		body = '';
		draftConversationId = null;
		setComposeOpen(false);
	};

	// Fill the header from the thread that asked for this. A draft survives
	// closing and reopening the same thread, but none of its recipient-specific
	// state crosses conversations. `$effect.pre` is the counterpart of upstream's
	// `useLayoutEffect`: it finishes before paint, so the previous thread's
	// recipients are never briefly revealed.
	$effect.pre(() => {
		const draft = composeDraft;
		if (draft == null) {
			return;
		}
		recipients = draft.recipients;
		subject = draft.subject;
		if (draftConversationId !== draft.conversationId) {
			cc = [];
			bcc = [];
			hasCc = false;
			hasBcc = false;
			body = '';
		}
		draftConversationId = draft.conversationId;
	});

	// ---- Queue ---------------------------------------------------------------

	const visible = $derived(CONVERSATIONS.filter((item) => inCategory(item, category)));

	// Static data, so this is computed once rather than per render.
	const unreadCounts = unreadByCategory();

	const selectionState = useTableSelectionState<Conversation>(() => ({
		// Scoped to `visible`, so select-all means "everything I can currently
		// see" rather than everything in the dataset.
		data: visible,
		idKey: 'id',
		selectedKeys,
		setSelectedKeys: (next) => (selectedKeys = next)
	}));

	const reveal = useContainerReveal();

	const surface = createSurfaceWidth();
	const list = createSurfaceWidth();

	/**
	 * The thread on screen: whatever was chosen, or the default when nothing has
	 * been.
	 *
	 * The default is the top of the list on a split layout and nothing at all on
	 * a single surface, where opening a thread means replacing the list — a
	 * phone that loads straight into somebody's first message has skipped the
	 * screen the user came for.
	 */
	const isMeasured = $derived(surface.width > 0);
	const isSingleSurface = $derived(isMeasured && surface.width < SINGLE_SURFACE_BELOW);
	const defaultOpenId = $derived(isSingleSurface ? null : (visible[0]?.id ?? null));

	/**
	 * A chosen thread only counts while it is still in the queue on screen.
	 *
	 * Switching category filters the list but says nothing about the pane, so a
	 * thread opened from Escalations would sit there while Resolved is in front
	 * of you — and the pane's own archive and delete would act on it. Falling
	 * back to the default re-derives the pane from the category, so the two
	 * cannot disagree about which queue you are in.
	 *
	 * An explicit close still wins: `null` means the user shut the pane, and
	 * changing category is no reason to reopen it.
	 */
	const openId = $derived(
		chosenId === null
			? null
			: chosenId !== undefined && visible.some((item) => item.id === chosenId)
				? chosenId
				: defaultOpenId
	);

	const openConversation = $derived(visible.find((item) => item.id === openId) ?? null);
	const isPaneFullWidth = $derived(isSingleSurface && openId != null);

	/**
	 * The movable boundary between the list and the pane.
	 *
	 * Single-region, because there is one boundary here and the list is not a
	 * sized region at all — it is whatever `LayoutContent` has left over. No
	 * `snaps`, which are not magnetism but the only positions the panel may rest
	 * at, and no `collapsible`, because both halves have to stay on screen.
	 *
	 * `defaultSize` is a rough first guess and not the real split. The hook takes
	 * its default once, on the first render, before the surface has been
	 * measured — and a percentage there is no better, because the hook resolves
	 * one against `window.innerWidth`, which is the very measurement this
	 * template cannot trust. The real answer arrives just below, as soon as
	 * there is a surface width to take a share of.
	 */
	let hasUserMovedPane = false;
	let isPlacingPane = false;
	const onPaneSizeChange = () => {
		if (isPlacingPane) {
			return;
		}
		hasUserMovedPane = true;
	};

	const pane = useResizable(() => ({
		defaultSize: '58%',
		minSizePx: PANE_MIN_WIDTH,
		// Everything the surface has, less the list's floor — so the ceiling
		// tracks the screen and the list keeps its whole range on any of them,
		// stacked rows included. Floored at the minimum, because a ceiling below
		// the floor is not a narrower range but an inverted one.
		maxSizePx: isMeasured
			? Math.max(PANE_MIN_WIDTH, surface.width - LIST_MIN_WIDTH)
			: undefined,
		onSizeChange: onPaneSizeChange
	}));

	// Land the pane on its share of the surface, and keep it there until the
	// handle is used. Following the surface rather than latching on the first
	// measurement is what makes the opening split survive being measured early:
	// a card in the catalog, a dialog mid-animation and a pane in a split editor
	// can all report a width that is real for one frame and wrong for the rest
	// of the session.
	$effect(() => {
		if (hasUserMovedPane || !isMeasured) {
			return;
		}
		isPlacingPane = true;
		pane.resize(Math.round(surface.width * PANE_DEFAULT_SHARE));
		isPlacingPane = false;
	});

	// Whether the rows stack is a question about the table, not the surface and
	// certainly not the window. A reading pane holding the majority of a wide
	// page leaves the table narrow long before anything else is narrow, so the
	// table's own width is what gets asked — measured, not subtracted.
	const listWidth = $derived(list.width);
	const isListMeasured = $derived(listWidth > 0);
	const isStacked = $derived(isListMeasured && listWidth < STACK_ROWS_BELOW);
	const isTight = $derived(isListMeasured && listWidth < TIGHTEN_COLUMNS_BELOW);

	// Touch never hovers, so the reveal shows the actions permanently there.
	// Overlaying content that never goes away is not a swap, it is a deletion.
	// `hover: none` and not `any-pointer: coarse`: the question is whether the
	// primary input can hover.
	const isTouch = useMediaQuery(() => '(hover: none)');

	const handleOpen = (item: Conversation) => {
		chosenId = item.id;
	};

	const rowStatus = useTableRowStatus<Conversation>(() => ({
		getStatus: (item: Conversation) =>
			item.isUnread ? { color: 'accent' as const, label: 'Unread' } : null
	}));

	const selection = useTableSelection<Conversation>(() => ({
		...selectionState.selectionConfig,
		getRowLabel: (item) => `conversation from ${item.sender}`,
		// The open row already owns the row background; two washes would fight.
		hasRowHighlight: false
	}));

	/**
	 * Makes each row a doorway and a reveal container at once.
	 *
	 * A `<tr>` has no activation of its own, so click, Enter and Space are wired
	 * by hand. The reveal container props ride along on the same element: the
	 * actions live two levels down in a `<td>`, and reach the state through
	 * inheritance rather than a selector, so the container can be the row.
	 *
	 * The open row is painted on its cells rather than the row itself, because
	 * the selection plugin owns `row.style.backgroundColor` and rewrites it on
	 * every notify.
	 */
	const rows = $derived<TablePlugin<Conversation>>({
		transformBodyRow: (props, item) => {
			const container = reveal.getContainerProps({ hoverDelay: HOVER_INTENT_MS });
			return {
				...props,
				htmlProps: {
					...props.htmlProps,
					class: [props.htmlProps.class, container.class].filter(Boolean).join(' '),
					style: [props.htmlProps.style, container.style].filter(Boolean).join('; '),
					tabindex: 0,
					'aria-current': item.id === openId ? true : undefined,
					onclick: (event: MouseEvent) => {
						if (isRowItself(event)) {
							handleOpen(item);
						}
					},
					onkeydown: (event: KeyboardEvent) => {
						// Same guard: Space on a focused checkbox must toggle it and
						// nothing else, and the keystroke bubbles to the row too.
						if ((event.key !== 'Enter' && event.key !== ' ') || !isRowItself(event)) {
							return;
						}
						event.preventDefault();
						handleOpen(item);
					}
				}
			};
		},
		transformBodyCell: (props, _column, item) =>
			item.id === openId
				? {
						...props,
						htmlProps: {
							...props.htmlProps,
							style: [props.htmlProps.style, OPEN_CELL_STYLE].filter(Boolean).join(' ')
						}
					}
				: props
	});

	// ---- Table columns -------------------------------------------------------

	const columns = $derived.by<TableColumn<Conversation>[]>(() => {
		const rowActions = isStacked ? NARROW_ROW_ACTIONS : ROW_ACTIONS;

		const received: TableColumn<Conversation> = {
			key: 'receivedAt',
			header: 'Received',
			// No wider than whichever of the two is actually in the cell. Wider is
			// the empty gap this layout exists to remove; narrower clips, because
			// a `truncate` table hides each cell's overflow.
			width: pixel(trailingWidth(rowActions.length, isTouch.matches)),
			align: 'end',
			renderCell: receivedCell
		};

		if (isStacked) {
			// Stacked, the row stops being tabular, and the columns that were
			// holding sender, subject and tags in the same place on every row have
			// nothing left to align. What survives is the pair that identifies a
			// thread — sender over subject — and the time. The preview is what
			// goes: the pane is one click away and reprints it in full, while a
			// subject lost to truncation is not recoverable from anywhere on
			// screen.
			//
			// Both plugin columns stay: they are 28px and 36px, they are the only
			// things in the row that are not text, and dropping either removes a
			// capability rather than a decoration.
			return [
				{
					key: 'conversation',
					// The header cannot be dropped: data mode renders one whenever
					// columns are defined, and going headerless means hand-composing
					// the rows, which loses the selection and row-status plugins
					// outright.
					header: 'Conversation',
					width: proportional(1, { minWidth: 160 }),
					renderCell: conversationCell
				},
				received
			];
		}

		const all: TableColumn<Conversation>[] = [
			{
				key: 'sender',
				header: 'From',
				width: pixel(190),
				renderCell: senderCell
			},
			{
				key: 'subject',
				header: 'Subject',
				width: proportional(3),
				renderCell: subjectCell
			},
			{
				key: 'tags',
				header: 'Tags',
				width: pixel(200),
				renderCell: tagsCell
			},
			received
		];

		// Tags are the first thing worth losing — the subject is what people scan.
		// Keyed off the table's width rather than off whether the pane is open,
		// because the pane is only one of the things that can take the width.
		return isTight ? all.filter((column) => column.key !== 'tags') : all;
	});

	// Stacked, the checkbox column goes. It is 36px of a roughly 300px table, it
	// sits in front of the one column carrying both the sender and the subject,
	// and multi-select is not what a narrow surface is for.
	//
	// Keys already selected are kept rather than cleared, so widening restores
	// exactly what was there. The cost is that the selection is briefly
	// invisible, which is why `hasSelection` is gated too.
	const tablePlugins = $derived<Record<string, TablePlugin<Conversation>>>(
		isStacked
			? { rowStatus, rows, gutter: ALIGN_STATUS_GUTTER }
			: { selection, rowStatus, rows, gutter: ALIGN_STATUS_GUTTER }
	);

	// Counted against the visible queue rather than the raw set, for the same
	// reason the pane re-derives: ticks made in Escalations must not still be
	// armed once Resolved is the list on screen. The set itself is left alone,
	// so switching back finds the selection where it was.
	const selectedCount = $derived(
		visible.filter((item) => selectedKeys.has(item.id)).length
	);
	const hasSelection = $derived(selectedCount > 0 && !isStacked);
	const unreadCount = CONVERSATIONS.filter((item) => item.isUnread).length;

	// ---- Lightbox (one instance; see the file header) ------------------------

	let lightboxMedia = $state<{ src: string; alt: string; caption: string }[]>([]);
	const lightbox = useLightbox(() => ({ media: lightboxMedia, hasZoom: true }));

	const openLightbox = (attachments: Attachment[], index: number) => {
		lightboxMedia = attachments.map((attachment) => ({
			src: attachment.src,
			alt: `Attachment: ${attachment.name}`,
			// The file name is the caption. It is the only thing identifying which
			// of three near-identical screenshots is on screen.
			caption: attachment.name
		}));
		lightbox.open(index);
	};
</script>



<!-- =============================================================================
     Table cells
     ============================================================================= -->

{#snippet receivedCell(item: Conversation)}
	{@const rowActions = isStacked ? NARROW_ROW_ACTIONS : ROW_ACTIONS}
	{@const actionReveal = reveal.getContentRevealProps()}
	<!--
		`height` reserves the buttons' line box. Without it the row is 40px at
		rest and 44px with the actions in it, so every row nudges its neighbours
		down as the cursor passes. Matching the small IconButton (28px) keeps the
		whole table on one rhythm.
	-->
	<HStack gap={1} vAlign="center" hAlign="end" height={28}>
		<!--
			No `isLayoutPreserved`: the position flip is the mechanism here, not a
			side effect of it. Layout-preserved content stays in flow at rest,
			which reserves exactly the width this layout exists to remove.
		-->
		<HStack
			class={actionReveal.class}
			style={isTouch.matches ? actionReveal.style : ACTIONS_CLAIM_CELL}
			gap={0.5}
			vAlign="center"
			hAlign="end"
		>
			{#each rowActions as action (action.id)}
				{#snippet actionIcon()}
					<Icon icon={action.icon} size="sm" />
				{/snippet}
				<IconButton
					variant="ghost"
					size="sm"
					label={`${action.label} — ${item.subject}`}
					tooltip={action.label}
					icon={actionIcon}
				/>
			{/each}
		</HStack>

		<!--
			`size="fill"` is what nominates the timestamp as the thing that gives:
			it is the only child here carrying the `min-width: 0` reset, so it is
			the only one flex is permitted to take width from. `maxLines` is what
			makes the giving invisible — a zero-width box still paints its text
			without it. Only the side-by-side build wears `isRevealInverted`.
		-->
		<StackItem size="fill">
			<HStack
				class={isTouch.matches
					? reveal.getContentRevealProps({ isRevealInverted: true }).class
					: undefined}
				style={isTouch.matches
					? `${HIDE_SQUEEZED_CONTENT} ${reveal.getContentRevealProps({ isRevealInverted: true }).style ?? ''}`
					: HIDE_SQUEEZED_CONTENT}
				gap={1}
				vAlign="center"
				hAlign="end"
			>
				{#if item.attachments.length !== 0}
					<!--
						Labelled, not decorative: this glyph is the only place the list
						says an attachment exists, so unlabelled it would take the fact
						away from anyone not looking at it.
					-->
					<Icon icon={PaperClipIcon} size="sm" color="gray" label="Has attachments" />
				{/if}
				<Text
					color="secondary"
					hasTabularNumbers
					justify="end"
					maxLines={1}
					hasTruncateTooltip={false}
					weight={item.isUnread ? 'semibold' : 'normal'}
				>
					{item.receivedAt}
				</Text>
			</HStack>
		</StackItem>
	</HStack>
{/snippet}

{#snippet conversationCell(item: Conversation)}
	<VStack gap={0.5}>
		<Text maxLines={1} weight={item.isUnread ? 'semibold' : 'normal'}>{item.sender}</Text>
		<!--
			Body size, not `supporting`. Stacked, these two lines are the whole row,
			and the subject is the half of them people actually read — dropping it
			to 12px made the thing being triaged smaller than the name attached to
			it. Secondary colour is enough to keep the sender first.
		-->
		<Text maxLines={1} color="secondary">{item.subject}</Text>
	</VStack>
{/snippet}

{#snippet senderCell(item: Conversation)}
	<HStack gap={2} vAlign="center">
		<Avatar name={item.sender} size="sm" tooltip={false} />
		<Text maxLines={1} weight={item.isUnread ? 'semibold' : 'normal'}>{item.sender}</Text>
	</HStack>
{/snippet}

{#snippet subjectCell(item: Conversation)}
	<HStack gap={2} vAlign="center">
		<!--
			`static` is what makes the subject win. Both children shrink by default
			and in proportion to their content, so the longer preview was keeping
			width the subject had already lost. Pinning the subject to its
			intrinsic size leaves the preview as the only thing that can give.
		-->
		<StackItem size="static">
			<Text maxLines={1} weight={item.isUnread ? 'semibold' : 'normal'}>{item.subject}</Text>
		</StackItem>
		<StackItem size="fill">
			<Text maxLines={1} color="secondary">— {item.preview}</Text>
		</StackItem>
	</HStack>
{/snippet}

{#snippet tagItem(entry: TagEntry, index: number)}
	<Token size="sm" color={entry.color} label={entry.label} />
{/snippet}

{#snippet overflowTags(hidden: OverflowItem<TagEntry>[])}
	<Token
		size="sm"
		label={`+${hidden.length}`}
		description={hidden.map((entry) => entry.value.label).join(', ')}
	/>
{/snippet}

{#snippet tagsCell(item: Conversation)}
	<!--
		Tokens truncate to nonsense when a fixed column runs out of room
		("Escal…", "Webho…"). OverflowList measures instead: it shows the ones
		that fit whole and collapses the rest to a count, so a tag is either
		readable or honestly absent. `observeParent` because the list itself is
		content-sized — it has to watch the cell.
	-->
	<OverflowList
		items={tagEntries(item)}
		gap={1}
		behavior="observeParent"
		item={tagItem}
		overflowRenderer={overflowTags}
	/>
{/snippet}

<!-- =============================================================================
     Reading pane
     ============================================================================= -->

{#snippet threadGutter()}
	<!--
		The avatar's column, continued past the row the avatar is on.

		A message's avatar and name are laid out by the collapsible's trigger; the
		body is in the collapsible's content, a different element entirely, so
		nothing lines the two up on its own and the prose ran out to the avatar's
		left edge. Reserving the avatar's width again below it starts the first
		character of the message under the first character of the sender, and
		leaves the avatars hanging in a column of their own down the side of the
		thread.
	-->
	<VStack width={AVATAR_SIZE} />
{/snippet}

{#snippet attachmentStrip(attachments: Attachment[])}
	{#if attachments.length !== 0}
		<VStack gap={2}>
			<HStack gap={1} vAlign="center">
				<Icon icon={PaperClipIcon} size="sm" color="gray" />
				<Text type="supporting" color="secondary">
					{attachments.length} attachment{attachments.length === 1 ? '' : 's'}
				</Text>
			</HStack>
			<HStack gap={2} wrap="wrap">
				{#each attachments as attachment, index (attachment.id)}
					<!--
						`onclick` is what makes each one a control: Thumbnail then
						supplies the button semantics, the accessible name and the
						press wash itself.
					-->
					<Thumbnail
						src={attachment.src}
						alt={`Preview of ${attachment.name}`}
						label={attachment.name}
						onclick={() => openLightbox(attachments, index)}
					/>
				{/each}
			</HStack>
		</VStack>
	{/if}
{/snippet}

{#snippet threadHistory(conversation: Conversation)}
	<VStack gap={2}>
		<!--
			No dividers. Each message already announces itself with an avatar, a
			name and an address on their own line, and a rule between them was a
			second boundary drawn where there was visibly one already —
			`density="spacious"` is doing that work with white space.
		-->
		{#key conversation.id}
			<!--
				A key is the whole fix for the remount: `defaultValue` is a default,
				so it is read once and never again — without remounting, the group
				carries the previous thread's open set into the next one, and since
				those ids are not in the new thread the result is a conversation with
				every message shut.
			-->
			<CollapsibleGroup
				type="multiple"
				density="spacious"
				defaultValue={[conversation.id]}
			>
				{#each threadMessages(conversation) as message (message.id)}
					{#snippet messageTrigger()}
						<HStack gap={THREAD_HEADER_GAP} vAlign="center" paddingInlineEnd={2}>
							<!--
								`tooltip={false}` is load-bearing, not cosmetic: a named
								Avatar owns a hover tooltip and takes a tab stop to make it
								keyboard-reachable, which would put a second tab stop inside
								the trigger's own button.
							-->
							<Avatar name={message.sender} tooltip={false} />
							<StackItem size="fill">
								<VStack gap={0.5}>
									<Text maxLines={1} weight="semibold">{message.sender}</Text>
									<Text maxLines={1} type="supporting" color="secondary">
										{message.senderEmail}
									</Text>
								</VStack>
							</StackItem>
							<Text type="supporting" color="secondary">{message.receivedFull}</Text>
						</HStack>
					{/snippet}
					{#snippet messageBody()}
						<HStack gap={THREAD_HEADER_GAP}>
							{@render threadGutter()}
							<StackItem size="fill">
								<VStack gap={3} maxWidth={MESSAGE_MEASURE}>
									{#each message.body as paragraph (paragraph)}
										<Text>{paragraph}</Text>
									{/each}
									{@render attachmentStrip(message.attachments ?? [])}
								</VStack>
							</StackItem>
						</HStack>
					{/snippet}
					<Collapsible value={message.id} trigger={messageTrigger} children={messageBody} />
				{/each}
			</CollapsibleGroup>
		{/key}
	</VStack>
{/snippet}

{#snippet threadActionNodes(conversation: Conversation)}
	{#each THREAD_ACTIONS as action (action.id)}
		{#snippet threadActionIcon()}
			<Icon icon={action.icon} size="sm" />
		{/snippet}
		<!--
			Named against the subject, because the pane is not the only Archive on
			screen — every row in the list behind it has one.
		-->
		<IconButton
			variant="ghost"
			label={`${action.label} — ${conversation.subject}`}
			tooltip={action.label}
			icon={threadActionIcon}
		/>
	{/each}
{/snippet}

{#snippet pageTypeToken(conversation: Conversation)}
	{#each conversation.tags as tag (tag)}
		<Token size="sm" label={tag} />
	{/each}
{/snippet}

{#snippet conversationPane(conversation: Conversation, isFullWidth: boolean)}
	{#snippet paneActions()}
		{@render threadActionNodes(conversation)}
		<IconButton
			variant="ghost"
			label="Close conversation"
			tooltip="Close"
			icon={closeIcon}
			onclick={() => (chosenId = null)}
		/>
	{/snippet}
	{#snippet threadActionsOnly()}
		{@render threadActionNodes(conversation)}
	{/snippet}
	{#snippet backIcon()}
		<Icon icon={ArrowLeftIcon} size="sm" class="template-mirror" />
	{/snippet}
	{#snippet replyIcon()}
		<Icon icon={ArrowUturnLeftIcon} size="sm" />
	{/snippet}
	{#snippet replyAllIcon()}
		<Icon icon={UsersIcon} size="sm" />
	{/snippet}

	{#snippet paneTitle()}
		<!--
			A plain h2: the pane's title, directly under the page's h1. It was on
			the display scale, which is built for hero copy and renders at a size
			the docsite's own type ramp does not use anywhere else.
		-->
		<Heading level={2} maxLines={2} hasTruncateTooltip>{conversation.subject}</Heading>
	{/snippet}

	{#snippet backButton()}
		<!-- Nothing is behind the pane to go back to visually, so the dismissal
		     has to name where it leads. -->
		<Button label="Inbox" variant="ghost" icon={backIcon} onclick={() => (chosenId = null)} />
	{/snippet}

	<VStack height="100%">
		<!--
			Two headers, because the subject and the way out compete for the same
			row and only one surface has room for both.

			Beside the list there is width to spare, so everything is one line:
			subject at the start, the three thread actions and the close button at
			the end. Full width, the navigation and the actions take the top row on
			their own and the subject drops beneath them, where it has the whole
			width and can afford a second line.

			No `dividers` on either. The subject is the widest, heaviest thing in
			the pane and separates itself from the message under it; a rule as well
			made two lines out of one boundary.
		-->
		{#if isFullWidth}
			<Toolbar label="Conversation" startContent={backButton} endContent={threadActionsOnly} />
			<VStack paddingBlockEnd={3}>
				<Heading
					level={3}
					accessibilityLevel={2}
					maxLines={2}
					hasTruncateTooltip
				>
					{conversation.subject}
				</Heading>
			</VStack>
		{:else}
			<!--
				Outer inset on top of the toolbar's own, and deliberately uneven: the
				title is a Heading with no side bearing at all, so it needs the
				larger share to reach 24px; the close button carries its own.
			-->
			<VStack paddingBlockStart={4} paddingInlineStart={3} paddingInlineEnd={2}>
				<Toolbar
					label="Conversation"
					startContent={paneTitle}
					endContent={paneActions}
				/>
			</VStack>
		{/if}

		<StackItem size="fill">
			<VStack
				paddingInline={isFullWidth ? 0 : 6}
				paddingBlockStart={0}
				paddingBlockEnd={isFullWidth ? 0 : 6}
				gap={4}
				isScrollable
				height="100%"
			>
				<!-- The subject these belong to is up in the header now, so this is
				     the first thing in the body. -->
				<HStack gap={2} vAlign="center" wrap="wrap">
					{#if conversation.priority !== 'normal'}
						<Token
							size="sm"
							color={PRIORITY_COLOR[conversation.priority]}
							label={PRIORITY_LABEL[conversation.priority]}
						/>
					{/if}
					{@render pageTypeToken(conversation)}
				</HStack>

				<!-- Every message in the thread, the newest one included and already
				     open. There is no separate block for it below. -->
				{@render threadHistory(conversation)}

				<!--
					In the scroll, directly under the last message, rather than pinned
					in a footer. Replying is the thing you do having read to the
					bottom, and a docked bar offers it from the top of a thread you
					have not read yet while spending a permanent strip of the pane to
					do so.
				-->
				<HStack gap={THREAD_HEADER_GAP}>
					{@render threadGutter()}
					<HStack gap={2}>
						<Button
							label="Reply"
							variant="primary"
							icon={replyIcon}
							onclick={() => startReply(replyDraft(conversation, false))}
						/>
						<!--
							Not a second reply arrow. The distinction between these two is
							who receives it, so the icon that separates them is the one
							about people.
						-->
						<Button
							label="Reply all"
							variant="secondary"
							icon={replyAllIcon}
							onclick={() => startReply(replyDraft(conversation, true))}
						/>
					</HStack>
				</HStack>
			</VStack>
		</StackItem>
	</VStack>
{/snippet}

{#snippet closeIcon()}
	<Icon icon={XMarkIcon} size="sm" />
{/snippet}

<!-- =============================================================================
     Composer
     ============================================================================= -->

{#snippet composerHeader()}
	<Toolbar
		label="Message"
		startContent={composerTitle}
		endContent={composerClose}
	/>
{/snippet}

{#snippet composerTitle()}
	<Heading level={2}>New message</Heading>
{/snippet}

{#snippet composerClose()}
	<!--
		The sheet draws a grab handle but no close button, and with no scrim there
		is nothing to tap outside it — which would leave Escape as the only way
		out, and that is not a control a touch user has.
	-->
	<IconButton
		variant="ghost"
		label="Close composer"
		tooltip="Close"
		icon={closeIcon}
		onclick={() => setComposeOpen(false)}
	/>
{/snippet}

{#snippet recipientEnd()}
	<!--
		Each disappears once it has been used, because it has nothing left to do —
		the field it summons is now on screen and is where copies are managed
		from. Keeping a spent button would also make it ambiguous whether pressing
		it again adds a second field or removes the one already there.
	-->
	{#if !hasCc}
		<Button label="Cc" variant="ghost" size="sm" onclick={() => (hasCc = true)} />
	{/if}
	{#if !hasBcc}
		<Button label="Bcc" variant="ghost" size="sm" onclick={() => (hasBcc = true)} />
	{/if}
{/snippet}

{#snippet composerContent()}
	<!--
		12px, to land on the same line the header and footer already use. Those
		two render through Section, which insets by 12 regardless of the Layout's
		own padding, while the content area falls back to 16 — so the fields were
		sitting four pixels inside the heading above them and the Send button
		below them.
	-->
	<LayoutContent padding={3}>
		<!--
			No visible labels, and no label grid to hold them. A mail header is one
			of the few forms whose fields are identified by their own contents —
			"Recipient" in an empty box is the label — and dropping the column moves
			the address to the left edge where the message under it starts.
		-->
		<VStack gap={2}>
			<Tokenizer
				label="Recipient"
				isLabelHidden
				placeholder="Recipient"
				searchSource={RECIPIENT_SOURCE}
				value={recipients}
				onChange={(items: SearchableItem[]) => (recipients = items)}
				hasCreate
				hasAutoFocus
				endContent={recipientEnd}
			/>
			{#if hasCc}
				<Tokenizer
					label="Cc"
					isLabelHidden
					placeholder="Cc"
					searchSource={RECIPIENT_SOURCE}
					value={cc}
					onChange={(items: SearchableItem[]) => (cc = items)}
					hasCreate
				/>
			{/if}
			{#if hasBcc}
				<Tokenizer
					label="Bcc"
					isLabelHidden
					placeholder="Bcc"
					searchSource={RECIPIENT_SOURCE}
					value={bcc}
					onChange={(items: SearchableItem[]) => (bcc = items)}
					hasCreate
				/>
			{/if}
			<TextInput
				label="Subject"
				isLabelHidden
				placeholder="Subject"
				value={subject}
				onChange={(next: string) => (subject = next)}
			/>
			<TextArea
				label="Message"
				isLabelHidden
				placeholder="Write your message…"
				value={body}
				onChange={(next: string) => (body = next)}
				rows={8}
				width="100%"
			/>
		</VStack>
	</LayoutContent>
{/snippet}

{#snippet composerFooter()}
	<!--
		Toolbar rather than a bare row, for the roving tabindex: the whole action
		row is one Tab stop with arrows moving inside it, instead of six stops
		between the message body and Discard.
	-->
	<Toolbar
		label="Message actions"
		dividers={['top']}
		startContent={composerActions}
		endContent={discardAction}
	/>
{/snippet}

{#snippet composerActions()}
	{#snippet sendIcon()}
		<Icon icon={PaperAirplaneIcon} size="sm" />
	{/snippet}
	<Button label="Send" variant="primary" icon={sendIcon} />
	{#each COMPOSER_TOOLS as tool (tool.id)}
		{#snippet toolIcon()}
			<Icon icon={tool.icon} size="sm" />
		{/snippet}
		<IconButton variant="ghost" label={tool.label} tooltip={tool.label} icon={toolIcon} />
	{/each}
{/snippet}

{#snippet discardAction()}
	{#snippet discardIcon()}
		<Icon icon={TrashIcon} size="sm" />
	{/snippet}
	<IconButton
		variant="ghost"
		label="Discard draft"
		tooltip="Discard draft"
		icon={discardIcon}
		onclick={discard}
	/>
{/snippet}

{#snippet composeWindow()}
	<!--
		`hasScrim={false}` keeps this bottom-edge composer non-modal: the inbox
		behind it stays live, because writing a message is exactly when someone
		needs to go back and read one. `purpose="form"` blocks the scrim tap and
		the downward swipe that would throw a half-written message away, and keeps
		Escape and the close button.

		`height="hug"` is `fit-content` under a ceiling, so the sheet is as tall as
		the composer and no taller; the Cc and Bcc rows appear and disappear, so
		the right height is not a constant.
	-->
	<BottomSheet
		isOpen={isComposeOpen}
		onOpenChange={setComposeOpen}
		purpose="form"
		label="New message"
		height="hug"
		hasScrim={false}
	>
		<!-- The sheet keeps a band under its grab handle at rest, so the Layout
		     starts below the pill without a band of its own. -->
		<VStack>
			<Layout
				height="auto"
				padding={4}
				defaultHasDividers
				header={composerHeader}
				content={composerContent}
				footer={composerFooter}
			/>
		</VStack>
	</BottomSheet>
{/snippet}

<!-- =============================================================================
     Page
     ============================================================================= -->

{#snippet pageHeader()}
	<!--
		No padding on the header itself: the tab strip's own rail is the line above
		the table now, and a rail has to sit directly on what it divides, which the
		header's bottom padding would prevent. `hasDivider` then only has work to
		do in the one state that has no rail to inherit — the full-width pane,
		which drops the tabs.
	-->
	<LayoutHeader hasDivider={isPaneFullWidth} padding={0}>
		<VStack gap={0}>
			<HStack gap={3} vAlign="center" wrap="wrap" padding={4}>
				<StackItem size="fill">
					<VStack gap={0.5}>
						<Heading level={1}>Inbox</Heading>
						<Text type="supporting">
							{unreadCount} unread of {CONVERSATIONS.length} conversations
						</Text>
					</VStack>
				</StackItem>
				<Button label="Refresh" variant="ghost" icon={refreshIcon} />
				<!--
					Compose belongs on this row rather than down with the tabs.
					Starting a message is unconditional — as true with nine rows
					selected as with none, and true of every bucket — so it sits beside
					Refresh in the row that never changes rather than in the one that
					reacts to selection. That row's existing `wrap` handles narrow.
				-->
				<Button
					label="Compose"
					variant="primary"
					icon={composeIcon}
					onclick={() => (isComposeOpen = true)}
				/>
			</HStack>

			{#if !isPaneFullWidth}
				{#if hasSelection}
					<!--
						In the strip's place, not above it. Stacking the two was
						costing a row of height the moment a checkbox was ticked,
						which moved the table out from under the pointer that had just
						clicked it. The band runs full-bleed on exactly the footprint
						the tab strip's rail just vacated; the fill is what separates
						it from the rows, which is why nothing draws a rule under it.
						The slot is pinned to `SELECTION_BAR_HEIGHT`, and only the
						slot: the band inside is free to be taller and the surplus is
						sent upward by bottom-aligning it.
					-->
					<VStack height={SELECTION_BAR_HEIGHT} vAlign="end" paddingBlockEnd={0.5}>
						<Section
							variant="muted"
							padding={3}
							paddingBlock={2}
							class="inbox-bulk-band"
						>
							<HStack gap={3} vAlign="center" minHeight={28}>
								<StackItem size="fill">
									<HStack gap={1} vAlign="center">
										{#each ROW_ACTIONS.filter((action) => action.id !== 'reply') as action (action.id)}
											{#snippet bulkActionIcon()}
												<Icon icon={action.icon} size="sm" />
											{/snippet}
											<Button
												label={action.label}
												variant="ghost"
												size="sm"
												icon={bulkActionIcon}
											/>
										{/each}
									</HStack>
								</StackItem>

								<!-- Grouped so the separator cannot strand itself at the end
								     of a line once the actions grow wide. -->
								<HStack gap={3} vAlign="center">
									<Text type="body">
										{selectedCount}
										{selectedCount === 1 ? 'conversation' : 'conversations'} selected
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
					</VStack>
				{:else}
					<!--
						Tabs, not a SegmentedControl, because these are places rather
						than filters — a thread has one standing at a time, and
						switching moves you rather than narrowing what you had. That is
						also what makes the badges meaningful.

						`role="tablist"` is deliberately not set: the list here is a
						single table whose contents change, with no per-tab panel to
						point `panelId` at. Left unset, the strip is a nav landmark
						marking the current bucket with `aria-current`.
					-->
					<!-- The 4px inset is what puts the tabs on the content line: a Tab
					     carries 12px of its own inline padding, so a strip flush to the
					     edge would start its first label at 12 while the heading above
					     starts at 16. -->
					<VStack paddingInline={1}>
						<TabList
							hasDivider
							value={category}
							onChange={(value: string) => (category = value as Category)}
						>
							{#each CATEGORIES as option (option.value)}
								{@const unread = unreadCounts[option.value]}
								{#snippet tabEnd()}
									<!--
										No zero badges. A badge is a call to look; one reading
										"0" is a call to look at nothing, and four of them turn
										the strip into noise the eye learns to skip.
									-->
									{#if unread !== 0}
										<Badge variant="neutral" label={unreadLabel} />
									{/if}
								{/snippet}
								{#snippet unreadLabel()}
									{unread}
									<VisuallyHidden> unread</VisuallyHidden>
								{/snippet}
								<Tab value={option.value} label={option.label} endContent={tabEnd} />
							{/each}
						</TabList>
					</VStack>
				{/if}
			{/if}
		</VStack>
	</LayoutHeader>
{/snippet}

{#snippet refreshIcon()}
	<Icon icon={ArrowPathIcon} size="sm" />
{/snippet}

{#snippet composeIcon()}
	<Icon icon={PencilSquareIcon} size="sm" />
{/snippet}

{#snippet inboxIcon()}
	<Icon icon={InboxIcon} size="lg" />
{/snippet}

{#snippet emptyActions()}
	<Button label="Go to Inbox" variant="secondary" onclick={() => (category = 'inbox')} />
{/snippet}

{#snippet listContent()}
	<!--
		`{@attach list.attach}` measures the list itself: whether rows stack is a
		question about the table, not the surface and certainly not the window.
	-->
	<LayoutContent padding={4} isScrollable {@attach list.attach}>
		{#if isPaneFullWidth && openConversation != null}
			{@render conversationPane(openConversation, true)}
		{:else if visible.length === 0}
			<VStack padding={6}>
				<!--
					An empty bucket is a normal, often good state — nothing waiting on
					a customer is a cleared queue, not a failed filter — so this says
					the bucket is empty rather than that a search found nothing.
				-->
				<EmptyState
					title="Nothing here"
					description="No conversations in this category."
					icon={inboxIcon}
					actions={emptyActions}
				/>
			</VStack>
		{:else}
			<Table
				data={visible}
				{columns}
				idKey="id"
				plugins={tablePlugins}
				density="balanced"
				dividers="none"
				hasHover
				textOverflow="truncate"
			/>
		{/if}
	</LayoutContent>
{/snippet}

{#snippet endPane()}
	<!--
		The handle comes before the panel, because the panel is in `end` and the
		boundary it drags is the panel's inline-START edge. `isReversed` is the
		other half: the hook grows a region as the pointer travels toward
		inline-end, and this one grows the other way.

		`hasDivider` moves here from the panel: LayoutPanel's own divider and the
		handle's are the same 1px line in the same place.
	-->
	<ResizeHandle
		direction="horizontal"
		isReversed
		hasDivider
		pillPlacement="end"
		resizable={pane.props}
		label="Resize conversation pane"
	/>
	<LayoutPanel
		resizable={pane.props}
		padding={0}
		role="complementary"
		label="Conversation"
	>
		{#if openConversation != null}
			{@render conversationPane(openConversation, false)}
		{/if}
	</LayoutPanel>
{/snippet}

<Layout
	height="fill"
	{@attach surface.attach}
	header={pageHeader}
	content={listContent}
	end={isSingleSurface || openConversation == null ? undefined : endPane}
/>

<!--
	Rendered outside the Layout because a native modal puts the window in the
	browser's top layer — its position in the tree is irrelevant to where it
	lands. Kept mounted rather than conditionally rendered so an unsent draft
	survives being closed.
-->
{@render composeWindow()}
<LightboxLayer {lightbox} />

<style>
	/* The bulk-selection band, matched to the one in the `table-filter` template:
	   same muted fill, same element radius, same entry. A radius because the band
	   is inset to the content line rather than run full-bleed. */
	:global(.inbox-bulk-band) {
		border-radius: var(--radius-element);
		/* The band mounts the moment the first row is checked, so the entry is a
		   `@starting-style` transition rather than a keyframe: the settled value is
		   the one written here, so an interrupted transition still lands
		   correctly. */
		opacity: 1;
		transform: translateY(0);
		transition-property: opacity, transform;
		transition-duration: var(--duration-medium, 200ms);
		transition-timing-function: var(--ease-standard, ease);
	}
	:global(.inbox-bulk-band) {
		@starting-style {
			opacity: 0;
			transform: translateY(var(--spacing-3));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.inbox-bulk-band) {
			transition-duration: 0s;
		}
	}
	:global([dir='rtl']) :global(.template-mirror) {
		transform: scaleX(-1);
	}
</style>
