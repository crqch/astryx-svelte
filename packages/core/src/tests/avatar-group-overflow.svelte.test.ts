/** PORTS: AvatarGroup/AvatarGroupOverflow.test.tsx */

// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file avatar-group-overflow.test.ts
 * @input Uses vitest, the browser, AvatarGroup, Avatar, and
 *   AvatarGroupOverflow
 * @output Overflow indicator's element, role, name, group size and shape,
 *   interactive branch, custom content, count bounds, refs and i18n label
 * @position Testing; validates `AvatarGroupOverflow`
 *
 * Astryx's `AvatarGroup/AvatarGroupOverflow.test.tsx`, ported case for case —
 * all 19 of upstream's 19 at the 0.7.13 pin. Runs in the **client (real
 * Chromium)** project, as the AvatarGroup suite does.
 *
 * React-only surface translated, not dropped:
 * - `ref` becomes an attachment in the rest props, the AvatarGroup suite's
 *   precedent. It receives the element, so each `instanceof` is upstream's
 *   unchanged;
 * - custom `children` go through `avatar-group-fixture.svelte`, since a
 *   snippet can only be authored in a template;
 * - `userEvent` comes from `vitest/browser`.
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createAttachmentKey } from 'svelte/attachments';
import AvatarGroupOverflow from '$lib/components/avatar-group/avatar-group-overflow.svelte';
import AvatarGroupFixture from './fixtures/avatar-group-fixture.svelte';
import AvatarGroupI18nFixture from './fixtures/avatar-group-i18n.svelte';

describe('AvatarGroupOverflow', () => {
	it('renders overflow count as span by default', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 5 } }
		});

		const overflow = screen.getByLabelText('5 more', { exact: true }).element();
		expect(overflow.tagName).toBe('SPAN');
		expect(overflow).toHaveTextContent('+5');
	});

	it('exposes the static overflow as a named image', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 5 } }
		});

		const overflow = screen.getByRole('img', { name: '5 more', exact: true }).element();
		expect(overflow).toHaveAttribute('role', 'img');
	});

	it('keeps a caller-supplied role on the static overflow', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 5, role: 'note' } }
		});

		expect(screen.getByLabelText('5 more', { exact: true }).element()).toHaveAttribute(
			'role',
			'note'
		);
	});

	it('reflects the group size on the overflow chip', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: {
				group: { size: 'lg' },
				avatars: [{ name: 'Alice' }],
				overflow: { count: 5 }
			}
		});

		const overflow = screen.getByLabelText('5 more', { exact: true }).element();
		expect(overflow.className).toContain('astryx-avatar-group-overflow');
		expect(overflow).toHaveAttribute('data-size', 'lg');
	});

	it('applies the group shape to the overflow chip, matching its avatars', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: {
				group: { shape: 'square' },
				avatars: [{ name: 'Alice' }],
				overflow: { count: 5 }
			}
		});

		expect(screen.getByLabelText('5 more', { exact: true }).element()).toHaveAttribute(
			'data-shape',
			'square'
		);
	});

	it('defaults the overflow chip to circle shape with no explicit AvatarGroup shape', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 5 } }
		});

		expect(screen.getByLabelText('5 more', { exact: true }).element()).toHaveAttribute(
			'data-shape',
			'circle'
		);
	});

	it('renders as button when onClick is provided', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 3, onclick: () => {} } }
		});

		const overflow = screen.getByRole('button', { name: '3 more', exact: true }).element();
		expect(overflow.tagName).toBe('BUTTON');
	});

	it('calls onClick when clicked', async () => {
		const handleClick = vi.fn();

		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 3, onclick: handleClick } }
		});

		await userEvent.click(screen.getByLabelText('3 more', { exact: true }));
		expect(handleClick).toHaveBeenCalledOnce();
	});

	it('renders custom children instead of default label', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 5 }, overflowChild: true }
		});

		await expect.element(screen.getByTestId('custom')).toBeInTheDocument();
	});

	it('works with sliced avatar list and server-side count', async () => {
		const users = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
		const serverTotal = 47;
		const visibleCount = 3;

		const screen = await render(AvatarGroupFixture, {
			props: {
				group: { size: 'lg' },
				avatars: users.slice(0, visibleCount).map((name) => ({ name })),
				overflow: { count: serverTotal - visibleCount }
			}
		});

		await expect.element(screen.getByLabelText('Alice', { exact: true })).toBeInTheDocument();
		await expect.element(screen.getByLabelText('Bob', { exact: true })).toBeInTheDocument();
		await expect.element(screen.getByLabelText('Charlie', { exact: true })).toBeInTheDocument();
		await expect.element(screen.getByLabelText('44 more', { exact: true })).toBeInTheDocument();
		await expect.element(screen.getByText('+44', { exact: true })).toBeInTheDocument();
	});

	it('forwards ref to the span element', async () => {
		// Counterpart to upstream's `ref`: an attachment in the rest props. It
		// receives the element rather than only proving a callback ran, so the
		// `instanceof` is upstream's unchanged.
		let node: Element | undefined;

		await render(AvatarGroupFixture, {
			props: {
				avatars: [{ name: 'Alice' }],
				overflow: {
					count: 3,
					[createAttachmentKey()]: (element: Element) => {
						node = element;
					}
				}
			}
		});

		expect(node).toBeInstanceOf(HTMLSpanElement);
	});

	it('forwards ref to the button element when onClick provided', async () => {
		let node: Element | undefined;

		await render(AvatarGroupFixture, {
			props: {
				avatars: [{ name: 'Alice' }],
				overflow: {
					count: 3,
					onclick: () => {},
					[createAttachmentKey()]: (element: Element) => {
						node = element;
					}
				}
			}
		});

		expect(node).toBeInstanceOf(HTMLButtonElement);
	});

	it('applies className prop', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 3, class: 'custom-class' } }
		});

		const overflow = screen.getByLabelText('3 more', { exact: true }).element();
		expect(overflow.className).toContain('custom-class');
	});

	it('handles count of zero gracefully', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 0 } }
		});

		await expect.element(screen.getByText('+0', { exact: true })).toBeInTheDocument();
		await expect.element(screen.getByLabelText('0 more', { exact: true })).toBeInTheDocument();
	});

	it('clamps a negative count rather than rendering "+-3"', async () => {
		// `count={total - visibleCount}` is the documented shape, and it goes
		// negative whenever the list is shorter than the slice.
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: -3 } }
		});

		expect(screen.getByText('+-3', { exact: true }).query()).toBeNull();
		await expect.element(screen.getByText('+0', { exact: true })).toBeInTheDocument();
		await expect.element(screen.getByLabelText('0 more', { exact: true })).toBeInTheDocument();
	});

	it('renders outside an AvatarGroup at the md fallback size', async () => {
		const screen = await render(AvatarGroupOverflow, {
			props: { count: 3, 'data-testid': 'loose' }
		});

		const overflow = screen.getByTestId('loose').element();
		expect(overflow).toHaveTextContent('+3');
		// inline-flex, so a standalone indicator stays a circle instead of
		// stretching to its parent's width.
		expect(overflow.tagName).toBe('SPAN');
	});

	it('handles very large count', async () => {
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 999 } }
		});

		await expect.element(screen.getByText('+999', { exact: true })).toBeInTheDocument();
	});

	it('renders the full "+N" text for wide multi-digit counts', async () => {
		// The indicator grows into a pill for long counts, so the entire number
		// must remain present (nothing clipped away in the DOM).
		const screen = await render(AvatarGroupFixture, {
			props: { avatars: [{ name: 'Alice' }], overflow: { count: 4912 } }
		});

		await expect.element(screen.getByText('+4912', { exact: true })).toBeInTheDocument();
		// The aria-label routes through the catalog's `{count, number}` ICU
		// argument, so the en locale adds a grouping separator.
		await expect.element(screen.getByLabelText('4,912 more', { exact: true })).toBeInTheDocument();
	});

	it('localizes the overflow label through the i18n catalog', async () => {
		const screen = await render(AvatarGroupI18nFixture, {
			props: {
				locale: 'fr',
				overrides: { fr: { '@astryx.avatarGroup.overflow': '{count, number} de plus' } },
				avatars: [{ name: 'Alice' }],
				overflow: { count: 3 }
			}
		});

		await expect.element(screen.getByLabelText('3 de plus', { exact: true })).toBeInTheDocument();
	});
});
