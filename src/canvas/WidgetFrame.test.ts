import { describe, expect, it } from 'vitest';
import { cardPadding } from './WidgetFrame';

describe('cardPadding', () => {
  it('follows the cell’s shorter side', () => {
    expect(cardPadding({ width: 600, height: 70 })).toBe(8);
  });

  it('stays readable in a sliver and modest in a large cell', () => {
    expect(cardPadding({ width: 300, height: 20 })).toBe(4);
    expect(cardPadding({ width: 1200, height: 800 })).toBe(16);
  });
});
