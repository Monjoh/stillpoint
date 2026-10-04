import type { BackgroundConfig } from '@/core/config/schema';

/**
 * Curated gradient backgrounds for the picker.
 *
 * A separate module from `presets.ts` on purpose: theme presets are read by
 * `apply.ts`, which `boot.ts` pulls onto the critical path, whereas this list is only
 * ever read by the background picker inside the lazy edit chunk. Keeping them apart
 * keeps a list of pretty colours out of the blocking boot script.
 *
 * Gradients, not photographs, are the default kind for a reason worth repeating: they
 * need no network, no asset store and no permission, so a fresh install looks
 * deliberate on the very first tab with nothing fetched and nothing chosen.
 *
 * All angles are 160° — down and slightly to the right, so the darker stop lands
 * under the clock, which sits above the middle of the canvas.
 */

export interface GradientPreset {
  id: string;
  name: string;
  from: string;
  to: string;
  angle: number;
}

const ANGLE = 160;

export const GRADIENT_PRESETS: readonly GradientPreset[] = [
  // The default, first. It is what a fresh install already has, so it is also the
  // "put it back" button.
  { id: 'midnight', name: 'Midnight', from: '#11131c', to: '#1d2033', angle: ANGLE },
  { id: 'ink', name: 'Ink', from: '#0d0d0f', to: '#1a1a20', angle: ANGLE },
  { id: 'dusk', name: 'Dusk', from: '#2b5876', to: '#4e4376', angle: ANGLE },
  { id: 'ember', name: 'Ember', from: '#2b1a17', to: '#5c2f26', angle: ANGLE },
  { id: 'moss', name: 'Moss', from: '#12201a', to: '#24402f', angle: ANGLE },
  { id: 'plum', name: 'Plum', from: '#241b2f', to: '#4a3159', angle: ANGLE },
  { id: 'slate', name: 'Slate', from: '#1c2226', to: '#39454d', angle: ANGLE },
  { id: 'tide', name: 'Tide', from: '#0f2027', to: '#2c5364', angle: ANGLE },
  // The two light ones, for Paper and for anyone who does not want a dark page.
  { id: 'paper', name: 'Paper', from: '#f7f2e8', to: '#e8e0d1', angle: ANGLE },
  { id: 'linen', name: 'Linen', from: '#fbfbf9', to: '#e6e8e6', angle: ANGLE },
];

/** A picker entry as the config stores it. */
export function gradientToBackground(preset: GradientPreset): BackgroundConfig {
  return {
    kind: 'gradient',
    from: preset.from,
    to: preset.to,
    angle: preset.angle,
  };
}

/**
 * The preset this background *is*, if any — so the picker can show which swatch is
 * selected rather than making the user remember.
 *
 * Matched on the stops and angle, not on an id, because the config stores the colours
 * and not which swatch they came from. That is the right thing to store: a gradient
 * stays what the user chose even if this list is later re-curated.
 */
export function matchGradient(
  background: BackgroundConfig,
): GradientPreset | undefined {
  if (background.kind !== 'gradient') return undefined;
  return GRADIENT_PRESETS.find(
    (p) =>
      p.from.toLowerCase() === background.from.toLowerCase() &&
      p.to.toLowerCase() === background.to.toLowerCase() &&
      p.angle === background.angle,
  );
}
