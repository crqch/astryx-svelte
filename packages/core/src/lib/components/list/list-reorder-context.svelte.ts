// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file list-reorder-context.svelte.ts
 * @input A registered key (utils/shared-realm.ts)
 * @output `REORDER_ENGINE`, the key a reorderable object carries its
 *   machinery under. Also the internal types between List, ListItem and that
 *   machinery: what a List hands its rows through ListContext's `reorder`.
 *   `useReorderSession` and `useReorderCommit` run the object's session for a
 *   List.
 * @position Internal to List. List imports only this module and the
 *   reorderable object's type, and ListItem only types. So the engine
 *   (list-reorder-engine.ts) is imported by the host alone, which List renders
 *   only when it has a `reorderable` object.
 *
 * Ported from Astryx's `List/listReorderContext.ts`. The React hooks become
 * runes: `useReorderSession` keeps one session per engine, and
 * `useReorderCommit` runs an effect after mount and a session swap.
 */

import { sharedKey } from '../../utils/shared-realm.js';
import type { Key } from './list-reorder-types.js';

/**
 * The key a reorderable object carries its machinery under. `sharedKey`
 * registers it, so a swizzled List reads a package object, and the package
 * List reads an object a copy adapted.
 */
export const REORDER_ENGINE = sharedKey('list/reorder-engine', 1);

/** What a List's reorder reports and asks. */
export interface ListReorderOptions {
	/** Called once per committed move: the item's key and its index after it. */
	readonly onReorder: (move: { key: Key; to: number }) => void;
	/** Whether the item with `key` moves; every item does without it. */
	readonly isReorderable?: (key: Key) => boolean;
	/**
	 * An adapted object's: the owner's options. Accepted for parity; this port
	 * has no adapting collection, so List reads it as the object's own options.
	 */
	readonly startedBy?: ListReorderOptions;
}

/** The parts of a List's reorder session that its List and rows use. */
export interface ListReorderSession {
	/**
	 * Runs after every List commit, after the list's layout updates. When a
	 * drop's new order is applied, each row's old place is put back. Its
	 * running spring then continues to the new one.
	 */
	commit(): void;
	/**
	 * Whether a drag or a reorder-mode move owns the list's next commit. The
	 * List's layout updates measure nothing for such a commit.
	 */
	ownsCommit(): boolean;
	/** The id of the handles' visually-hidden instructions. */
	readonly hintId: string;
	/** Records a handle and its row's item key; returns the removal. */
	registerHandle(handle: Element | null, key: Key): () => void;
	/** Records a row's (or handle's) name for announcements; returns the removal. */
	registerName(row: Element | null, name: string): () => void;
	/** Whether `handle`'s row is in reorder mode. */
	isInMode(handle: Element | null): boolean;
	/** Calls `listener` when reorder mode starts, moves or ends. */
	subscribeMode(listener: () => void): () => void;
	/** The handle whose row is in reorder mode, if any. */
	readonly modeTarget: HTMLElement | null;
	/** A handle without a drag: enters or leaves its row's reorder mode. */
	toggleMode(handle: HTMLElement | null): void;
	/** A key in reorder mode: arrows move the row, Escape ends the mode. */
	keyDown(handle: HTMLElement | null, event: KeyboardEvent): void;
	/** A handle lost focus to `next`. */
	blur(handle: HTMLElement | null, next: EventTarget | null): void;
	/**
	 * `handle` stopped taking gestures: a drag it started goes home, and its
	 * reorder mode ends.
	 */
	release(handle: Element | null): void;
	/** Whether `handle`'s latest press dragged; reading it clears it. */
	takeDrag(handle: Element | null): boolean;
	/** The 1-based place of the row that holds `element`, or null. */
	positionOf(element: Element | null): number | null;
	/** Reorder mode's move, one place up (`-1`) or down (`1`). */
	step(handle: HTMLElement | null, delta: -1 | 1): void;
	/** Ends reorder mode, keeping its moves. */
	endMode(): void;
	/** Records reorder mode's hint element (null once it goes). */
	setHintElement(element: HTMLElement | null): void;
	/** Reorder mode for the item with `key`; whether it entered. */
	startByKey(key: Key): boolean;
	/** Calls `listener` after every commit, when the rows may have moved. */
	subscribeCommit(listener: () => void): () => void;
}

/** The machinery a reorderable object carries. */
export interface ListReorderEngine {
	/** A List's reorder session over the rows of the element `getList` returns. */
	createSession(getList: () => HTMLElement | null, hintId: string): ListReorderSession;
	/**
	 * Reorder mode for the item with `key`, started from the app's own UI. It
	 * runs in the collection the object with `options` is mounted on, or the
	 * one mounted last if several.
	 */
	start(options: ListReorderOptions, key: Key): void;
}

/** What a reorderable object holds (reorderable/create-reorderable.ts). */
export interface ReorderableInternals {
	readonly options: ListReorderOptions;
	readonly [REORDER_ENGINE]: ListReorderEngine;
	/** Reorder mode for the item with `key`, from the app's own UI. */
	start(key: Key): void;
}

/** What a reorderable List hands its rows. */
export interface ListReorderContextValue {
	readonly session: ListReorderSession;
	readonly options: ListReorderOptions;
}

/** A reorder session and the options of the object that runs it. */
export interface ReorderSessionOf {
	readonly session: ListReorderSession | null;
	readonly options: ListReorderOptions | null;
}

/**
 * The reorder session over the children of the element `getList` returns,
 * run by `reorderable`'s engine. Both fields are null without an object.
 * `hintId` names the handles' instructions. The object may be made on every
 * render: the session lasts as long as its engine and reads the object's
 * latest callbacks.
 */
export function useReorderSession(
	getReorderable: () => unknown,
	getList: () => HTMLElement | null,
	hintId: string
): ReorderSessionOf {
	// One session per engine, as upstream's `useMemo([engine, hintId])`: a
	// consumer may make a new object on every render, and that must keep the
	// session (and its reorder mode) alive.
	let cachedEngine: unknown = null;
	let cachedSession: ListReorderSession | null = null;
	const session = $derived.by(() => {
		const reorder = getReorderable() as ReorderableInternals | undefined;
		const engine = reorder?.[REORDER_ENGINE];
		if (engine !== cachedEngine) {
			cachedEngine = engine;
			cachedSession = engine == null ? null : engine.createSession(() => getList(), hintId);
		}
		return cachedSession;
	});
	const options = $derived((getReorderable() as ReorderableInternals | undefined)?.options ?? null);
	return {
		get session() {
			return session;
		},
		get options() {
			return options;
		}
	};
}

/**
 * Applies a drop's new order after each commit. A caller with layout updates
 * calls it after them, so a drop's commit is the reorder's. The engine also
 * schedules a commit after each reported move, because a Svelte list has no
 * hook that runs after every consumer render; this effect covers the mount and
 * a session swap.
 */
export function useReorderCommit(getSession: () => ListReorderSession | null): void {
	$effect(() => {
		const session = getSession();
		if (session == null) {
			return;
		}
		// The session's first commit needs the host's configuration effect,
		// which may be created after this one; a microtask runs after every
		// mount effect and after the DOM is in place.
		queueMicrotask(() => session.commit());
	});
}
