/**
 * Ported from Astryx's `gestures/gestureSync.ts`, the framework-free half.
 *
 * The React file also owns an unmount ref; this port's hooks keep that flag
 * locally, where their own effect ordering makes it true before the cleanup
 * that releases the recognizer or tracker runs.
 */
let syncingDepth = 0;

/** Runs `body` as a gesture sync: no hook listener reports inside it. */
export function syncingGestures<T>(body: () => T): T {
	syncingDepth += 1;
	try {
		return body();
	} finally {
		syncingDepth -= 1;
	}
}

/** True while any gesture hook's sync runs. */
export function isSyncingGestures(): boolean {
	return syncingDepth > 0;
}
