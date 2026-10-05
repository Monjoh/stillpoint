import { readFileSync } from 'node:fs';
import { cleanup } from '@testing-library/react';
import { generateChromeMessages, parseMessagesText } from '@wxt-dev/i18n/build';
import { afterEach } from 'vitest';
import { browser } from 'wxt/browser';

afterEach(cleanup);

/**
 * jsdom has no ResizeObserver. The canvas measures itself with one, so without a stub
 * every component test would render an unmeasured canvas and assert nothing useful.
 *
 * This stub reports a fixed box and notifies on observe, which is enough for the
 * canvas to lay out once. Tests that care about resizing drive it themselves.
 */
const DEFAULT_BOX = { width: 1200, height: 800 };

class StubResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    const rect = {
      ...DEFAULT_BOX,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: DEFAULT_BOX.width,
      bottom: DEFAULT_BOX.height,
      toJSON: () => ({}),
    } satisfies DOMRectReadOnly;

    this.callback(
      [{ target, contentRect: rect } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= StubResizeObserver;

/**
 * jsdom implements no part of the Pointer Capture API. Edit mode takes capture on
 * every pointer down, so without this any test that clicks a widget throws — and it
 * throws asynchronously, out of the event handler, where it surfaces as an unhandled
 * error beside a passing test rather than as a failure. Stubbed globally rather than
 * per file so that a new test cannot quietly inherit the noise.
 */
Element.prototype.setPointerCapture ??= function setPointerCapture() {};
Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
Element.prototype.hasPointerCapture ??= function hasPointerCapture() {
  return false;
};

/**
 * No test reaches the network. Unsplash code takes an injectable `fetch`; anything
 * that falls through to the global one is a test that would pass or fail on someone
 * else's server, and fails here instead, loudly.
 */
globalThis.fetch = () =>
  Promise.reject(new Error('A test tried to reach the network. Inject a fetch.'));

/**
 * Strings come from `browser.i18n.getMessage`, which WXT's fake browser does not
 * implement. Serve it from the real `src/locales/en.yml`, compiled the way the build
 * compiles it, so tests assert the English a user sees and a missing key fails here.
 *
 * Assigned rather than spied on: `restoreMocks` would undo a spy after every test.
 */
const messages = generateChromeMessages(
  parseMessagesText(readFileSync('src/locales/en.yml', 'utf8'), 'YAML'),
);
browser.i18n.getMessage = (name: string, substitutions?: string | string[]) => {
  const entry = messages[name];
  if (!entry) return '';
  const subs = substitutions === undefined ? [] : [substitutions].flat();
  return entry.message
    .replace(/\$(\w+)\$/g, (_, placeholder: string) =>
      (entry.placeholders?.[placeholder.toLowerCase()]?.content ?? '').replace(
        /\$(\d)/g,
        (__, n: string) => subs[Number(n) - 1] ?? '',
      ),
    )
    .replace(/\$(\d)/g, (_, n: string) => subs[Number(n) - 1] ?? '')
    .replace(/\$\$/g, '$');
};
