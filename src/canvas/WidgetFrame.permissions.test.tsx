import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { actAsFirefox } from '@/core/__fixtures__/permissions';
import { layoutSchema, widgetInstanceSchema } from '@/core/config/schema';
import { computeGeometry } from './geometry';
import { WidgetFrame } from './WidgetFrame';

/**
 * A widget whose data source needs a host permission fetches nothing until it has
 * one, and the frame offers the click that asks for it.
 */

const geometry = computeGeometry(layoutSchema.parse({}), { width: 1200, height: 800 });
const stocks = (settings: object = {}) =>
  widgetInstanceSchema.parse({
    instanceId: 'w1',
    type: 'stillpoint.stocks',
    rect: { x: 0, y: 0, w: 6, h: 3 },
    settings,
    frame: {},
  });

beforeEach(() => {
  for (const event of [browser.permissions.onAdded, browser.permissions.onRemoved]) {
    vi.spyOn(event, 'addListener').mockImplementation(() => {});
    vi.spyOn(event, 'removeListener').mockImplementation(() => {});
  }
});

describe('WidgetFrame and host permissions', () => {
  it('offers Allow in place of the widget, and fetches nothing', async () => {
    vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => false);
    const request = vi
      .spyOn(browser.permissions, 'request')
      .mockImplementation(async () => false);
    const fetch = vi.spyOn(globalThis, 'fetch');

    render(<WidgetFrame instance={stocks()} geometry={geometry} isEditing={false} />);
    expect(await screen.findByText('Stocks needs your permission')).toBeTruthy();
    expect(screen.getByText(/query1\.finance\.yahoo\.com/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(request).toHaveBeenCalledWith({
      origins: ['https://query1.finance.yahoo.com/*'],
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('points out of edit mode, where its layer covers the button', async () => {
    vi.spyOn(browser.permissions, 'contains').mockImplementation(async () => false);
    render(<WidgetFrame instance={stocks()} geometry={geometry} isEditing />);
    expect(await screen.findByText(/Leave edit mode to allow it/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull();
  });

  it('asks nothing of a source that needs no permission', async () => {
    const contains = vi.spyOn(browser.permissions, 'contains');
    render(
      <WidgetFrame
        instance={stocks({ source: 'twelvedata' })}
        geometry={geometry}
        isEditing={false}
      />,
    );
    expect(await screen.findByText(/Add your Twelve Data key/)).toBeTruthy();
    expect(contains).not.toHaveBeenCalled();
  });
});

describe('WidgetFrame and data-collection consent', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const weather = widgetInstanceSchema.parse({
    instanceId: 'w2',
    type: 'stillpoint.weather',
    rect: { x: 0, y: 0, w: 6, h: 3 },
    settings: { location: { name: 'Paris', latitude: 48.85, longitude: 2.35 } },
    frame: {},
  });

  it('sends no location before Firefox has the user’s consent', async () => {
    const { request } = actAsFirefox({ granted: false });
    const fetch = vi.spyOn(globalThis, 'fetch');

    render(<WidgetFrame instance={weather} geometry={geometry} isEditing={false} />);
    expect(await screen.findByText('Weather needs your permission')).toBeTruthy();
    expect(screen.getByText(/It sends the place you chose/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(request).toHaveBeenCalledWith({ data_collection: ['locationInfo'] });
    expect(fetch).not.toHaveBeenCalled();
  });
});
