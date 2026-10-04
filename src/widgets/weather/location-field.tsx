import { lazy, Suspense } from 'react';
import type { ControlProps } from '@/core/registry/types';
import type { WeatherLocation } from './definition';

/**
 * The Place control, behind a lazy import. A custom control is named in the schema's
 * metadata, and the schema is on the new tab's critical path through the registry.
 * Imported directly, the control and its city search would load on every new tab to
 * be used in the settings panel only.
 */
const LocationControl = lazy(() => import('./LocationControl'));

export function LocationField(props: ControlProps<WeatherLocation | null>) {
  return (
    <Suspense fallback={null}>
      <LocationControl {...props} />
    </Suspense>
  );
}
