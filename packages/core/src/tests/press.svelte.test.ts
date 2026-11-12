/** PORTS: privateAttributes/press.test.ts */

import { afterEach, describe, expect, it } from 'vitest';
import { PRESS_BELIEVED_SELECTOR } from '$lib/private-attributes/press.js';

/**
 * Astryx's `privateAttributes/press.test.ts`, ported case for case — one
 * `describe` with five cases.
 *
 * Upstream runs these in jsdom; this port has no jsdom project, so the file
 * lives in the client project (its filename is what selects it) and runs
 * against real Chromium. The selector is the same CSS `matches()` sees.
 */

function mount(html: string) {
	document.body.innerHTML = html;
	return (id: string) => document.getElementById(id)!.matches(PRESS_BELIEVED_SELECTOR);
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('PRESS_BELIEVED_SELECTOR', () => {
	it('reaches the pressed element and the themed parts inside it', () => {
		// Switch marks its unclassed row; the themed track and thumb sit inside.
		const matches = mount(`
      <div id="row" data-astryx-pressable data-astryx-press="on">
        <span id="track" class="astryx-switch"><span id="thumb"></span></span>
      </div>`);
		expect(matches('row')).toBe(true);
		expect(matches('track')).toBe(true);
		expect(matches('thumb')).toBe(true);
	});

	it('does not reach a control inside a pressed row', () => {
		const matches = mount(`
      <div id="row" data-astryx-pressable data-astryx-press="on">
        <span id="label">Label</span>
        <button id="button" data-astryx-pressable><span id="icon"></span></button>
      </div>`);
		expect(matches('row')).toBe(true);
		expect(matches('label')).toBe(true);
		expect(matches('button')).toBe(false);
		expect(matches('icon')).toBe(false);
	});

	it('does not reach a pressable row around a pressed control', () => {
		const matches = mount(`
      <div id="row" data-astryx-pressable>
        <button id="button" data-astryx-pressable data-astryx-press="on"></button>
      </div>`);
		expect(matches('button')).toBe(true);
		expect(matches('row')).toBe(false);
	});

	it('reaches a non-pressable themed element around the pressed one', () => {
		const matches = mount(`
      <span id="wrapper" class="astryx-checkbox">
        <input id="input" data-astryx-pressable data-astryx-press="on" />
      </span>`);
		expect(matches('wrapper')).toBe(true);
	});

	it('matches nothing while no press is believed', () => {
		const matches = mount(`
      <div id="row" data-astryx-pressable>
        <button id="button" data-astryx-pressable></button>
      </div>`);
		expect(matches('row')).toBe(false);
		expect(matches('button')).toBe(false);
	});
});
