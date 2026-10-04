import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
