import { describe, expect, it } from 'vitest';
import { folderBox, MARGIN, placeFolder } from './folder-layout';

const viewport = { width: 1440, height: 900 };

describe('folderBox', () => {
  it('lays tiles four across at the widget’s icon size', () => {
    const box = folderBox({ count: 6, mode: 'tiles', maxPx: 48, viewport });
    expect(box).toMatchObject({ mode: 'tiles', columns: 4, icon: 48 });
    // Four tiles of two icons, two rows, and half an icon of padding all round.
    expect(box.width).toBe(48 * 9);
    expect(box.height).toBe(48 * 5);
  });

  it('is as narrow as a folder of one or two', () => {
    expect(folderBox({ count: 2, mode: 'icons', maxPx: 48, viewport }).columns).toBe(2);
  });

  it('lists in one column, at the smaller list icon', () => {
    expect(folderBox({ count: 5, mode: 'list', maxPx: 50, viewport })).toMatchObject({
      columns: 1,
      icon: 30,
    });
  });

  it('shrinks the icons rather than outgrow the window', () => {
    const small = { width: 400, height: 300 };
    const box = folderBox({ count: 24, mode: 'tiles', maxPx: 96, viewport: small });
    expect(box.width).toBeLessThanOrEqual(small.width - 2 * MARGIN);
    expect(box.height).toBeLessThanOrEqual(small.height - 2 * MARGIN);
  });
});

describe('placeFolder', () => {
  const box = { width: 300, height: 200 };
  const tile = (left: number, top: number) => ({
    left,
    top,
    right: left + 80,
    bottom: top + 80,
  });

  it('opens below its tile, centred on it', () => {
    expect(placeFolder(tile(500, 100), box, viewport)).toEqual({
      left: 540 - 150,
      top: 180 + MARGIN,
    });
  });

  it('opens above when there is no room below', () => {
    expect(placeFolder(tile(500, 750), box, viewport).top).toBe(750 - MARGIN - 200);
  });

  it('stays inside the window at its edges', () => {
    expect(placeFolder(tile(0, 100), box, viewport).left).toBe(MARGIN);
    expect(placeFolder(tile(1400, 100), box, viewport).left).toBe(1440 - MARGIN - 300);
  });

  it('covers its tile when there is room on neither side', () => {
    const short = { width: 1440, height: 260 };
    expect(placeFolder(tile(500, 90), box, short).top).toBe(30);
  });
});
