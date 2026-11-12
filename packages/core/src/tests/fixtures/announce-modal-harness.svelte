<script lang="ts" module>
	export type AnnounceModalScenario =
		| 'owner-dialog'
		| 'owner-sheet'
		| 'owner-drawer'
		| 'owner-sheet-nonmodal'
		| 'owner-sheet-in-dialog'
		| 'owner-mobile-nav'
		| 'owner-lightbox'
		| 'owner-nonmodal-drawer'
		| 'popover-sheet'
		| 'dropdown-sheet'
		| 'nested-owners'
		| 'modal-over-modal'
		| 'covered-clear'
		| 'opening-field-error'
		| 'opening-empty-withdraw'
		| 'same-commit-empty'
		| 'closed-content'
		| 'inner-opening-dialog'
		| 'inner-opening-sheet'
		| 'join-messages'
		| 'save-close'
		| 'upper-close'
		| 'steps-represent'
		| 'sibling-flow'
		| 'sheet-exit-owner'
		| 'sheet-exit-two'
		| 'conditional-dialog'
		| 'switcher'
		| 'busy-app-dialog'
		| 'busy-withdraw'
		| 'busy-shared-words'
		| 'sheet-over-dialog'
		| 'open-from-above'
		| 'provider-owner'
		| 'sheet-rest'
		| 'dialog-count-other'
		| 'dialog-count-close'
		| 'dialog-opening-count'
		| 'dialog-exiting-step'
		| 'dialog-replace-typist'
		| 'dialog-replace-typist-assertive'
		| 'sheet-exit-count-other'
		| 'app-form'
		| 'busy-nonmodal-drawer';

	export interface AnnounceModalHarnessProps {
		scenario: AnnounceModalScenario;
		/** Used by `sheet-rest`: the controlled open state of one BottomSheet. */
		isOpen?: boolean;
		/** Used by `switcher`: what step one's owner announces. */
		switcherMessage?: string;
	}
</script>

<script lang="ts">
	import Dialog from '$lib/components/dialog/dialog.svelte';
	import BottomSheet from '$lib/components/bottom-sheet/bottom-sheet.svelte';
	import BottomSheetSwitcher from '$lib/components/bottom-sheet/bottom-sheet-switcher.svelte';
	import Drawer from '$lib/components/drawer/drawer.svelte';
	import Lightbox from '$lib/components/lightbox/lightbox.svelte';
	import MobileNav from '$lib/components/mobile-nav/mobile-nav.svelte';
	import Popover from '$lib/components/popover/popover.svelte';
	import DropdownMenu from '$lib/components/dropdown-menu/dropdown-menu.svelte';
	import ModalAnnounceProvider from '$lib/hooks/modal-announce-provider.svelte';
	import AnnounceOwner from './announce-owner.svelte';
	import AnnounceTwoOwner from './announce-two-owner.svelte';
	import AnnounceCountOther from './announce-count-other.svelte';
	import AnnounceEffectOwner from './announce-effect-owner.svelte';
	import AnnounceFieldError from './announce-field-error.svelte';
	import AnnounceOpeningCount from './announce-opening-count.svelte';
	import AnnounceBusyThing from './announce-busy-thing.svelte';
	import AnnounceSearchOutcome from './announce-search-outcome.svelte';
	import AnnounceThen from './announce-then.svelte';
	import AnnouncePair from './announce-pair.svelte';
	import AnnounceOpener from './announce-opener.svelte';
	import AnnounceReplaceTypist from './announce-replace-typist.svelte';
	import AnnounceCountOtherDone from './announce-count-other-done.svelte';
	import AnnounceAppForm from './announce-app-form.svelte';

	/**
	 * The declarative shapes upstream writes inline as JSX. A Svelte test cannot
	 * author components in a case, so every modal-announcement scenario lives
	 * here and the tests vary `scenario` and the few stateful props.
	 */
	const {
		scenario,
		isOpen = true,
		switcherMessage = 'Overview saved'
	}: AnnounceModalHarnessProps = $props();

	let upperOpen = $state(false);
	let innerOpen = $state(false);
	let hostOpen = $state(true);
	// The sheet-exit scenarios start open; the sheet-over-dialog one starts closed
	// so the case can open it, as upstream's does.
	let sheetOpen = $state(true);
	let overSheetOpen = $state(false);
	let step = $state(1);
	let switcherSheet = $state<string | null>('one');
	let stepsContent = $state<HTMLDivElement>();
	let providerContent = $state<HTMLDivElement>();
	let appDialog = $state<HTMLDialogElement>();

	// The steps scenario presents its entering step from a later effect, as
	// upstream's layout effect does.
	$effect(() => {
		void step;
		const dialog = stepsContent?.closest('dialog') ?? null;
		if (dialog != null && !dialog.open) {
			dialog.showModal();
		}
	});

	// The app-owned dialog inside the Outer Dialog opens itself.
	$effect(() => {
		const dialog = appDialog;
		if (dialog != null && !dialog.open) {
			dialog.showModal();
		}
	});

	function providerDialog(): HTMLDialogElement | null {
		return providerContent?.closest('dialog') ?? null;
	}
</script>

{#if scenario === 'owner-dialog'}
	<Dialog {isOpen} onOpenChange={() => {}} aria-label="Modal">
		<AnnounceOwner />
	</Dialog>
{:else if scenario === 'owner-sheet'}
	<BottomSheet {isOpen} onOpenChange={() => {}} label="Modal">
		<AnnounceOwner />
	</BottomSheet>
{:else if scenario === 'owner-drawer'}
	<Drawer {isOpen} onOpenChange={() => {}} label="Modal">
		<AnnounceOwner />
	</Drawer>
{:else if scenario === 'owner-sheet-nonmodal'}
	<BottomSheet {isOpen} onOpenChange={() => {}} hasScrim={false} label="Sheet">
		<AnnounceOwner />
	</BottomSheet>
{:else if scenario === 'owner-sheet-in-dialog'}
	<Dialog {isOpen} onOpenChange={() => {}} aria-label="Modal">
		<BottomSheet isOpen onOpenChange={() => {}} hasScrim={false} label="Sheet">
			<AnnounceOwner />
		</BottomSheet>
	</Dialog>
{:else if scenario === 'owner-mobile-nav'}
	<MobileNav {isOpen} onOpenChange={() => {}} label="Menu">
		<AnnounceOwner />
	</MobileNav>
{:else if scenario === 'owner-lightbox'}
	{#snippet caption()}
		<AnnounceOwner />
	{/snippet}
	<Lightbox {isOpen} onOpenChange={() => {}} media={{ src: '/photo.jpg', alt: 'Photo', caption }} />
{:else if scenario === 'owner-nonmodal-drawer'}
	<AnnounceEffectOwner message="Page loaded" />
	<Drawer {isOpen} onOpenChange={() => {}} hasScrim={false} label="Side">
		<AnnounceEffectOwner message="Inside drawer" />
	</Drawer>
{:else if scenario === 'popover-sheet'}
	<Popover label="Filters" presentation="bottom-sheet" content={popoverContent}>
		<button type="button">Filter</button>
	</Popover>
{:else if scenario === 'dropdown-sheet'}
	<DropdownMenu
		button={{ label: 'Project actions' }}
		presentation="bottom-sheet"
		items={[{ label: 'Edit project', onClick: () => {} }]}
		footer={dropdownFooter}
	/>
{:else if scenario === 'nested-owners'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Lower">
		<AnnounceOwner label="Lower say" message="Lower words" />
		<Dialog isOpen onOpenChange={() => {}} aria-label="Upper">
			<AnnounceOwner label="Upper say" message="Upper words" />
		</Dialog>
	</Dialog>
{:else if scenario === 'modal-over-modal'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Lower">
		<AnnounceOwner label="Lower say" message="Lower words" />
		<button type="button" onclick={() => (upperOpen = true)}>Open upper</button>
		<Dialog isOpen={upperOpen} onOpenChange={(open) => (upperOpen = open)} aria-label="Upper">
			<AnnounceOwner label="Upper say" message="Upper words" />
		</Dialog>
	</Dialog>
{:else if scenario === 'covered-clear'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Lower">
		<AnnounceOwner label="Lower say" message="Lower words" />
		<button type="button" onclick={() => (upperOpen = true)}>Cover</button>
		<Dialog isOpen={upperOpen} onOpenChange={(open) => (upperOpen = open)} aria-label="Upper">
			<button type="button" onclick={() => (upperOpen = false)}>Uncover</button>
		</Dialog>
	</Dialog>
{:else if scenario === 'opening-field-error'}
	<button type="button" onclick={() => (hostOpen = true)}>Open</button>
	{#if hostOpen}
		<Dialog isOpen onOpenChange={() => {}} aria-label="Edit">
			<AnnounceFieldError />
		</Dialog>
	{/if}
{:else if scenario === 'opening-empty-withdraw'}
	<button type="button" onclick={() => (hostOpen = true)}>Open</button>
	{#if hostOpen}
		<Dialog isOpen onOpenChange={() => {}} aria-label="Edit">
			<AnnounceFieldError withdraw />
		</Dialog>
	{/if}
{:else if scenario === 'same-commit-empty'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
		<AnnouncePair />
	</Dialog>
{:else if scenario === 'closed-content'}
	<AnnounceEffectOwner message="Page loaded" />
	<Dialog isOpen={false} onOpenChange={() => {}} aria-label="Closed">
		<AnnounceEffectOwner message="Inside closed" />
	</Dialog>
{:else if scenario === 'inner-opening-dialog'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Outer">
		<button type="button" onclick={() => (innerOpen = true)}>Open inner</button>
		{#if innerOpen}
			<Dialog isOpen onOpenChange={() => {}} aria-label="Inner">
				<AnnounceFieldError />
			</Dialog>
		{/if}
	</Dialog>
{:else if scenario === 'inner-opening-sheet'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Outer">
		<button type="button" onclick={() => (innerOpen = true)}>Open inner</button>
		{#if innerOpen}
			<BottomSheet isOpen onOpenChange={() => {}} label="Inner">
				<AnnounceFieldError />
			</BottomSheet>
		{/if}
	</Dialog>
{:else if scenario === 'join-messages'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
		<AnnounceTwoOwner />
		<AnnounceOwner politeness="assertive" message="Failed" label="Fail" />
	</Dialog>
{:else if scenario === 'save-close'}
	<Dialog isOpen={hostOpen} onOpenChange={(open) => (hostOpen = open)} aria-label="Edit">
		<AnnounceThen message="Saved" label="Save and close" onDone={() => (hostOpen = false)} />
	</Dialog>
{:else if scenario === 'upper-close'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Lower">
		<Dialog isOpen={upperOpen} onOpenChange={(open) => (upperOpen = open)} aria-label="Upper">
			<AnnounceThen message="3 results" label="Pick" onDone={() => (upperOpen = false)} />
		</Dialog>
	</Dialog>
{:else if scenario === 'steps-represent'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
		<div bind:this={stepsContent}>
			<AnnounceOwner message={`Step ${step} words`} />
			<button
				type="button"
				onclick={() => {
					// Close the dialog as the leaving step would, and move on; the next
					// commit's effect presents the entering step.
					stepsContent?.closest('dialog')?.close();
					step = 2;
				}}>Next</button
			>
		</div>
	</Dialog>
{:else if scenario === 'sibling-flow'}
	<Dialog isOpen={step === 1} onOpenChange={() => {}} aria-label="One">
		<AnnounceOwner message="Step one saved" label="Say" />
		<button type="button" onclick={() => (step = 2)}>Next</button>
	</Dialog>
	<Dialog isOpen={step === 2} onOpenChange={() => {}} aria-label="Two">
		<span>Step two</span>
	</Dialog>
{:else if scenario === 'sheet-exit-owner'}
	<BottomSheet isOpen={sheetOpen} onOpenChange={(open) => (sheetOpen = open)} label="Sheet">
		<AnnounceOwner message="Saved" />
		<button type="button" onclick={() => (sheetOpen = false)}>Done</button>
	</BottomSheet>
{:else if scenario === 'sheet-exit-two'}
	<BottomSheet isOpen={sheetOpen} onOpenChange={(open) => (sheetOpen = open)} label="Sheet">
		<AnnounceTwoOwner />
		<button type="button" onclick={() => (sheetOpen = false)}>Done</button>
	</BottomSheet>
{:else if scenario === 'conditional-dialog'}
	{#if hostOpen}
		<Dialog isOpen onOpenChange={() => {}} aria-label="Edit">
			<AnnounceOwner message="Saved" />
			<button type="button" onclick={() => (hostOpen = false)}>Remove</button>
		</Dialog>
	{/if}
{:else if scenario === 'switcher'}
	<BottomSheetSwitcher
		activeSheet={switcherSheet}
		onActiveSheetChange={(sheet) => (switcherSheet = sheet)}
	>
		<BottomSheet sheetId="one" label="One" data-testid="switcher-one">
			<AnnounceOwner message={switcherMessage} />
			<button type="button" onclick={() => (switcherSheet = 'two')}>Continue</button>
		</BottomSheet>
		<BottomSheet sheetId="two" label="Two" data-testid="switcher-two">
			<button type="button" onclick={() => (switcherSheet = 'one')}>Back</button>
		</BottomSheet>
	</BottomSheetSwitcher>
{:else if scenario === 'busy-app-dialog'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Outer">
		<dialog bind:this={appDialog} aria-label="App">
			<AnnounceBusyThing />
			<button type="button">App action</button>
		</dialog>
	</Dialog>
{:else if scenario === 'busy-withdraw'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
		<AnnounceSearchOutcome />
	</Dialog>
{:else if scenario === 'busy-shared-words'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
		<AnnounceBusyThing label="one" />
		<AnnounceBusyThing label="two" />
	</Dialog>
{:else if scenario === 'sheet-over-dialog'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Edit">
		<button type="button" onclick={() => (overSheetOpen = true)}>Open sheet</button>
		<BottomSheet
			isOpen={overSheetOpen}
			onOpenChange={(open) => (overSheetOpen = open)}
			label="Sheet"
		>
			<AnnounceOwner message="Saved" />
			<button type="button" onclick={() => (overSheetOpen = false)}>Done</button>
		</BottomSheet>
	</Dialog>
{:else if scenario === 'open-from-above'}
	<AnnounceOpener />
{:else if scenario === 'provider-owner'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
		<div bind:this={providerContent}>
			<ModalAnnounceProvider dialogRef={providerDialog} isOpen>
				<AnnounceOwner message="Routed in" />
			</ModalAnnounceProvider>
		</div>
	</Dialog>
{:else if scenario === 'sheet-rest'}
	<BottomSheet {isOpen} onOpenChange={() => {}} label="Rest">
		<AnnounceOwner />
	</BottomSheet>
{:else if scenario === 'dialog-count-other'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
		<AnnounceCountOther />
	</Dialog>
{:else if scenario === 'dialog-count-close'}
	<Dialog isOpen={hostOpen} onOpenChange={(open) => (hostOpen = open)} aria-label="Modal">
		<AnnounceCountOther />
		<button type="button" onclick={() => (hostOpen = false)}>Close</button>
	</Dialog>
{:else if scenario === 'dialog-opening-count'}
	<button type="button" onclick={() => (hostOpen = true)}>Open</button>
	{#if hostOpen}
		<Dialog isOpen onOpenChange={() => {}} aria-label="Edit">
			<AnnounceOpeningCount />
		</Dialog>
	{/if}
{:else if scenario === 'sheet-exit-count-other'}
	<BottomSheet isOpen={sheetOpen} onOpenChange={(open) => (sheetOpen = open)} label="Sheet">
		<AnnounceCountOtherDone onDone={() => (sheetOpen = false)} />
	</BottomSheet>
{:else if scenario === 'dialog-replace-typist'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
		<AnnounceReplaceTypist
			messages={[
				['1 result', 'polite'],
				['Create "Urgent"', 'polite']
			]}
		/>
	</Dialog>
{:else if scenario === 'dialog-replace-typist-assertive'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Modal">
		<AnnounceReplaceTypist
			messages={[
				['3 results', 'polite'],
				['Search failed', 'assertive']
			]}
		/>
	</Dialog>
{:else if scenario === 'app-form'}
	<Dialog isOpen onOpenChange={() => {}} aria-label="Edit">
		<AnnounceAppForm />
	</Dialog>
{:else if scenario === 'busy-nonmodal-drawer'}
	<Drawer isOpen onOpenChange={() => {}} hasScrim={false} label="Side">
		<AnnounceSearchOutcome />
	</Drawer>
{:else if scenario === 'dialog-exiting-step'}
	<Dialog isOpen={step === 1} onOpenChange={() => {}} aria-label="One">
		<AnnounceCountOther />
		<button type="button" onclick={() => (step = 2)}>Continue</button>
	</Dialog>
	<Dialog isOpen={step === 2} onOpenChange={() => {}} aria-label="Two">
		<span>Step two</span>
	</Dialog>
{/if}

{#snippet popoverContent()}
	<AnnounceOwner />
{/snippet}

{#snippet dropdownFooter()}
	<AnnounceOwner />
{/snippet}
