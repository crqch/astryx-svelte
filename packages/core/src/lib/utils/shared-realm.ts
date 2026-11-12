/**
 * Ported from Astryx's `utils/sharedRealm.ts`.
 *
 * One value per key in the JavaScript realm, shared by every copy of Core, plus
 * the shapes that hold it. Pure JavaScript; no DOM and no Svelte.
 */

/**
 * The registered key of a shared value. The version names the value's shape.
 * Change it when a copy built against the old shape cannot read the value.
 */
export function sharedKey(name: string, version: number): symbol {
	return Symbol.for(`@astryxdesign/core/${name}/v${version}`);
}

/**
 * The value under `key` in this JavaScript realm, created on first use. Every
 * copy of Core that asks for the same key gets the same value.
 */
export function realmValue<T>(
	key: symbol,
	create: () => T,
	accepts: (value: unknown) => boolean = () => true
): T {
	const realm = globalThis as typeof globalThis & { [key: symbol]: unknown };
	if (Object.hasOwn(realm, key)) {
		const existing = realm[key];
		return accepts(existing) ? (existing as T) : create();
	}
	const value = create();
	realm[key] = value;
	return value;
}

/** One value per page under a registered name. */
export function sharedState<T>(name: string, version: number, create: () => T): T {
	return realmValue(sharedKey(name, version), create);
}

/** A map shared by every copy of Core under a registered name. */
export function sharedMap<K, V>(name: string, version: number): Map<K, V> {
	return sharedState(name, version, () => new Map<K, V>());
}

/** A weak map shared by every copy of Core. */
export function sharedWeakMap<K extends WeakKey, V>(name: string, version: number): WeakMap<K, V> {
	return sharedState(name, version, () => new WeakMap<K, V>());
}

/** A weak set shared by every copy of Core. */
export function sharedWeakSet<T extends WeakKey>(name: string, version: number): WeakSet<T> {
	return sharedState(name, version, () => new WeakSet<T>());
}

/** A value and its listeners, in a subscribe/get shape. */
export interface SharedStore<T> {
	get: () => T;
	set: (value: T) => void;
	subscribe: (listener: () => void) => () => void;
}

/** A value and its listeners shared by every copy of Core. */
export function sharedStore<T>(name: string, version: number, initial: T): SharedStore<T> {
	return sharedState(name, version, () => {
		let value = initial;
		const listeners = new Set<() => void>();
		return {
			get: () => value,
			set: (next) => {
				if (Object.is(next, value)) return;
				value = next;
				for (const listener of [...listeners]) listener();
			},
			subscribe: (listener) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			}
		};
	});
}

/** The next number of a sequence every copy of Core shares. */
export function sharedSequence(name: string, version: number): () => number {
	const counter = sharedState(name, version, () => ({ next: 0 }));
	return () => {
		counter.next += 1;
		return counter.next;
	};
}

/** Test-only: forget every shared value whose name starts with `prefix`. */
export function resetSharedStateForTest(prefix = ''): void {
	const realm = globalThis as typeof globalThis & { [key: symbol]: unknown };
	const start = `@astryxdesign/core/${prefix}`;
	for (const key of Object.getOwnPropertySymbols(realm)) {
		if (key.description?.startsWith(start)) {
			Reflect.deleteProperty(realm, key);
		}
	}
}
