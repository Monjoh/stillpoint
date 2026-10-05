import { i18n } from '#i18n';
import { useCallback, useState } from 'react';
import type { Profile, Rect } from '@/core/config/schema';
import { widgetRegistry } from '@/core/registry';
import { rectToPixels, type CanvasGeometry } from '../geometry';
import { placeWidget, removeWidget } from '../operations';
import { alignmentGuides } from './guides';
import {
  cellDelta,
  isPlacementValid,
  moveRect,
  resizeRect,
  RESIZE_HANDLES,
  type ResizeHandle,
} from './placement';
import styles from './EditLayer.module.css';

/**
 * Selection, dragging, resizing, grid dots and alignment guides — as a layer of boxes
 * over the widgets rather than as chrome around each one.
 *
 * Keeping it separate is what stops edit mode leaking into the view-mode path:
 * `WidgetFrame` knows nothing about any of this, the widgets underneath have their
 * pointer events switched off, and the whole file loads only when someone edits.
 *
 * A drag writes to the config on every *cell* crossed, not every pointer event, so the
 * widget itself moves under the cursor and there is no ghost to reconcile. The store
 * debounces the actual storage write.
 */

export interface EditLayerProps {
  geometry: CanvasGeometry;
  profile: Profile;
  selectedId: string | null;
  onSelect: (instanceId: string | null) => void;
  onChange: (profile: Profile) => void;
  /** ⌘D. Handled by EditMode, which also says when there is no room. */
  onDuplicate: (instanceId: string) => void;
  /** Called when an interaction finishes, to flush the debounced write. */
  onCommit?: () => void;
}

interface DragState {
  instanceId: string;
  /** `null` means a move rather than a resize. */
  handle: ResizeHandle | null;
  pointerX: number;
  pointerY: number;
  startRect: Rect;
  minSize: { w: number; h: number };
}

export function EditLayer({
  geometry,
  profile,
  selectedId,
  onSelect,
  onChange,
  onDuplicate,
  onCommit,
}: EditLayerProps) {
  const [drag, setDrag] = useState<DragState | null>(null);

  // `profile` can be read directly in these handlers, with no "latest value" ref.
  // Pointer capture is taken on the box, so the moves retarget to it and bubble to
  // this layer's own React handler — which is re-created with fresh props on every
  // render, and the component re-renders on every committed cell.

  const beginDrag = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      instanceId: string,
      handle: ResizeHandle | null,
    ) => {
      // Secondary buttons are for the context menu, not for dragging.
      if (event.button !== 0) return;
      const instance = profile.widgets.find((w) => w.instanceId === instanceId);
      if (!instance) return;

      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      onSelect(instanceId);

      setDrag({
        instanceId,
        handle,
        pointerX: event.clientX,
        pointerY: event.clientY,
        startRect: instance.rect,
        minSize: widgetRegistry.get(instance.type)?.minSize ?? { w: 1, h: 1 },
      });
    },
    [profile.widgets, onSelect],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!drag) return;

      const { dCols, dRows } = cellDelta(
        event.clientX - drag.pointerX,
        event.clientY - drag.pointerY,
        geometry,
      );

      const candidate = drag.handle
        ? resizeRect(
            drag.startRect,
            drag.handle,
            dCols,
            dRows,
            profile.layout,
            drag.minSize,
          )
        : moveRect(drag.startRect, dCols, dRows, profile.layout);

      const current = profile.widgets.find((w) => w.instanceId === drag.instanceId);
      if (current && sameRect(current.rect, candidate)) return;

      // An invalid drop is simply not taken: the widget stays at the last position
      // that worked and the drag continues. Nothing is pushed aside, and nothing has
      // to be undone when the pointer is released.
      if (!isPlacementValid(candidate, drag.instanceId, profile.widgets)) return;

      onChange(placeWidget(profile, drag.instanceId, candidate));
    },
    [drag, geometry, profile, onChange],
  );

  const endDrag = useCallback(() => {
    if (!drag) return;
    setDrag(null);
    onCommit?.();
  }, [drag, onCommit]);

  const nudge = useCallback(
    (instanceId: string, dCols: number, dRows: number, resizing: boolean) => {
      const instance = profile.widgets.find((w) => w.instanceId === instanceId);
      if (!instance) return;

      const minSize = widgetRegistry.get(instance.type)?.minSize ?? { w: 1, h: 1 };
      const next = resizing
        ? resizeRect(instance.rect, 'se', dCols, dRows, profile.layout, minSize)
        : moveRect(instance.rect, dCols, dRows, profile.layout);

      if (!isPlacementValid(next, instanceId, profile.widgets)) return;
      onChange(placeWidget(profile, instanceId, next));
      onCommit?.();
    },
    [profile, onChange, onCommit],
  );

  const onBoxKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, instanceId: string) => {
      const step = ARROWS[event.key];
      if (step) {
        event.preventDefault();
        nudge(instanceId, step[0], step[1], event.shiftKey);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        onChange(removeWidget(profile, instanceId));
        onSelect(null);
        onCommit?.();
        return;
      }

      if (event.key.toLowerCase() === 'd' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onDuplicate(instanceId);
      }
    },
    [profile, nudge, onChange, onDuplicate, onSelect, onCommit],
  );

  const dragged = drag
    ? profile.widgets.find((w) => w.instanceId === drag.instanceId)
    : null;
  const guides = dragged
    ? alignmentGuides(dragged.rect, profile.widgets, profile.layout, dragged.instanceId)
    : [];

  return (
    <div
      className={styles.layer}
      onPointerDown={() => onSelect(null)}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Dots and guides appear with a drag and leave with it. A permanent grid
          overlay is noise on a page whose whole point is the user's own background. */}
      {drag && (
        <div
          className={styles.dots}
          aria-hidden="true"
          style={{
            backgroundSize: `${geometry.cellWidth + geometry.gap}px ${
              geometry.cellHeight + geometry.gap
            }px`,
          }}
        />
      )}

      {guides.map((guide) => (
        <div
          key={`${guide.axis}${guide.at}`}
          className={styles.guide}
          data-axis={guide.axis}
          data-kind={guide.kind}
          aria-hidden="true"
          style={
            guide.axis === 'x'
              ? {
                  left: `${guide.at * (geometry.cellWidth + geometry.gap)}px`,
                  top: 0,
                  bottom: 0,
                }
              : {
                  top: `${guide.at * (geometry.cellHeight + geometry.gap)}px`,
                  left: 0,
                  right: 0,
                }
          }
        />
      ))}

      {profile.widgets.map((instance) => {
        const box = rectToPixels(instance.rect, geometry);
        const selected = instance.instanceId === selectedId;
        const name = widgetRegistry.get(instance.type)?.name ?? instance.type;

        return (
          <div
            key={instance.instanceId}
            className={styles.box}
            data-selected={selected || undefined}
            data-dragging={drag?.instanceId === instance.instanceId || undefined}
            // A real focusable element rather than a hijacked Tab key: Tab then
            // cycles widgets and toolbar buttons the way it cycles anything else,
            // focus is visible, and a screen reader is told what each box is.
            tabIndex={0}
            role="button"
            aria-label={i18n.t('edit.widgetBox', {
              name,
              column: instance.rect.x + 1,
              row: instance.rect.y + 1,
              width: instance.rect.w,
              height: instance.rect.h,
            })}
            aria-pressed={selected}
            style={{
              left: `${box.left}px`,
              top: `${box.top}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
            }}
            onPointerDown={(event) => beginDrag(event, instance.instanceId, null)}
            onFocus={() => onSelect(instance.instanceId)}
            onKeyDown={(event) => onBoxKeyDown(event, instance.instanceId)}
          >
            {selected &&
              RESIZE_HANDLES.map((handle) => (
                <span
                  key={handle}
                  className={styles.handle}
                  data-handle={handle}
                  onPointerDown={(event) =>
                    beginDrag(event, instance.instanceId, handle)
                  }
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

const ARROWS: Record<string, [number, number] | undefined> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
