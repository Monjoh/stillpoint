import type { Profile } from '@/core/config/schema';
import { computeGeometry } from './geometry';
import { useElementSize } from './useElementSize';
import { WidgetFrame } from './WidgetFrame';
import styles from './Canvas.module.css';

/**
 * The canvas: one viewport, never more.
 *
 * Widgets are absolutely positioned from grid cells, and cell size is measured rather
 * than stored — see `geometry.ts`. Nothing is rendered until the canvas has been
 * measured once, because laying out from a guessed viewport and correcting a frame
 * later is a visible jump on every new tab.
 *
 * There is no layout library here on purpose. View mode is the critical path, it runs
 * on every tab the user opens, and absolute positioning from a measured box is all it
 * needs. Drag and resize load with edit mode, which almost never runs.
 */

export interface CanvasProps {
  profile: Profile;
  isEditing: boolean;
  onRemoveWidget?: (instanceId: string) => void;
}

export function Canvas({ profile, isEditing, onRemoveWidget }: CanvasProps) {
  const [canvasRef, size] = useElementSize<HTMLDivElement>();
  const geometry = size ? computeGeometry(profile.layout, size) : null;

  return (
    <div className={styles.stage}>
      <div className={styles.canvas} ref={canvasRef}>
        {geometry &&
          profile.widgets.map((instance) => (
            <WidgetFrame
              key={instance.instanceId}
              instance={instance}
              geometry={geometry}
              isEditing={isEditing}
              onRemove={
                onRemoveWidget ? () => onRemoveWidget(instance.instanceId) : undefined
              }
            />
          ))}
      </div>
    </div>
  );
}
