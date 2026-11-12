<!--
	The `CouponField` function component from upstream's
	`templates/blocks/components/Hooks/useInputStatusIconHookUsage.tsx`. Svelte
	has no in-file component declaration, so it is a sibling module; the example
	registry only looks for `<BlockName>.svelte`, so this file is never listed.

	One translation beyond the hook/layer split: upstream composes the wrapper
	from the published `inputWrapperStyles` / `inputStatusBorderStyles` StyleX
	objects, which a `.svelte` file cannot call `stylex.props()` on. The same
	declarations are written in the scoped `<style>` block below.
-->
<script lang="ts">
	import { Field, InputStatusIcon, useInputStatusIcon } from '@astryx-sv/core';
	import type { FieldStatusVariant, InputStatus } from '@astryx-sv/core';

	const VALID_CODE = 'SAVE20';

	interface Props {
		statusVariant: FieldStatusVariant;
	}

	const { statusVariant }: Props = $props();

	const uid = $props.id();
	const inputId = `${uid}-input`;
	const messageId = `${uid}-message`;

	let code = $state('SAVE10');

	const status = $derived<InputStatus | undefined>(
		code === ''
			? undefined
			: code.toUpperCase() === VALID_CODE
				? { type: 'success', message: 'Code applied: 20% off.' }
				: { type: 'error', message: 'This code is not valid.' }
	);

	// The hook decides what the field shows for this status and variant, and
	// returns the id of its tooltip only when that tooltip is in the DOM.
	const statusIcon = useInputStatusIcon(() => ({
		id: `${uid}-status-tip`,
		status,
		statusVariant
	}));

	// `attached` and `detached` carry the text in a message box under the field;
	// `tooltip` carries it in the hook's tooltip instead.
	const hasMessageBox = $derived(statusVariant !== 'tooltip' && !!status?.message);
	const ariaDescribedBy = $derived(
		[hasMessageBox ? messageId : null, statusIcon.describedBy].filter(Boolean).join(' ') ||
			undefined
	);
</script>

<Field
	label="Coupon code"
	isLabelHidden
	inputID={inputId}
	status={status ? { ...status, messageID: messageId } : undefined}
	{statusVariant}
>
	<div
		class="coupon-field"
		class:status-error={status?.type === 'error'}
		class:status-success={status?.type === 'success'}
	>
		<input
			id={inputId}
			type="text"
			aria-invalid={status?.type === 'error' || undefined}
			aria-describedby={ariaDescribedBy}
			placeholder="Enter a coupon code"
			value={code}
			oninput={(event) => (code = event.currentTarget.value)}
			class="coupon-input"
		/>
		<InputStatusIcon {statusIcon} />
	</div>
</Field>

<style>
	.coupon-field {
		box-sizing: border-box;
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding-block: var(--spacing-1);
		padding-inline: var(--spacing-3);
		border: var(--border-width) solid var(--color-border-emphasized);
		border-radius: var(--radius-element);
		background-color: var(--color-background-surface);
		transition:
			border-color var(--duration-fast) var(--ease-standard),
			box-shadow var(--duration-fast) var(--ease-standard);
		outline: none;
	}

	.coupon-field:hover:not(:focus-within):where(:not(:disabled, [aria-disabled='true'])) {
		box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-border-emphasized) 30%, transparent);
	}

	.coupon-field:focus-within {
		border-color: var(--color-accent);
		box-shadow: inset 0 0 0 2px var(--color-accent-muted);
	}

	.coupon-field.status-error {
		border-color: var(--color-border-error);
	}

	.coupon-field.status-success {
		border-color: var(--color-border-success);
	}

	.coupon-input {
		flex-grow: 1;
		min-width: 0;
		border-width: 0;
		background-color: transparent;
		color: var(--color-text-primary);
		font: inherit;
		outline: none;
	}
</style>
