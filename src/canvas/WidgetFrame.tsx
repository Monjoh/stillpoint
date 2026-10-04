import { Component, Suspense, useMemo, type ErrorInfo, type ReactNode } from 'react';
import type { WidgetInstance } from '@/core/config/schema';
import { widgetRegistry } from '@/core/registry';
import { resolveSettings } from '@/core/registry/settings';
import { rectToPixels, type CanvasGeometry } from './geometry';
import styles from './WidgetFrame.module.css';

/**
 * The chrome around every widget instance, and the place "a widget cannot break the
 * page" is actually enforced. Four separate failures are contained here:
 *
 * - **Unknown type** — a widget we removed, or a config imported from a newer build.
 *   Renders a placeholder that holds the position and keeps the settings. Never
 *   deletes the instance: the user may be about to downgrade back.
 * - **Unusable settings** — `safeParse` with a repair pass, see `resolveSettings`.
 * - **A thrown render** — caught per instance, so the rest of the canvas survives.
 * - **A failed lazy import** — the Suspense boundary covers the wait, the error
 *   boundary covers the failure.
 */

export interface WidgetFrameProps {
  instance: WidgetInstance;
  geometry: CanvasGeometry;
  isEditing: boolean;
  /** Offered in the failure state. Omitted in view mode, where nothing is editable. */
  onRemove?: () => void;
}

export function WidgetFrame({
  instance,
  geometry,
  isEditing,
  onRemove,
}: WidgetFrameProps) {
  const box = rectToPixels(instance.rect, geometry);
  const { frame } = instance;

  const definition = widgetRegistry.get(instance.type);
  const Widget = widgetRegistry.load(instance.type);

  const resolved = useMemo(
    () =>
      definition
        ? resolveSettings(definition.settingsSchema, instance.settings)
        : { settings: null, repaired: false },
    [definition, instance.settings],
  );

  const padding = frame.showBackground ? cardPadding(box) : 0;
  const fade = frame.opacity / 100;
  // The content box the widget actually gets, which is what `WidgetProps.size` means.
  const size = {
    width: Math.max(0, box.width - padding * 2),
    height: Math.max(0, box.height - padding * 2),
  };

  let content: ReactNode;
  if (!definition || !Widget) {
    content = (
      <FrameNotice
        title="Widget not available"
        detail={`This profile uses "${instance.type}", which this version of Stillpoint does not have. Its position and settings are kept.`}
      />
    );
  } else if (resolved.settings === null) {
    content = (
      <FrameNotice
        title="Settings could not be read"
        detail={`${definition.name} has settings this version cannot interpret.`}
        onRemove={isEditing ? onRemove : undefined}
      />
    );
  } else {
    content = (
      <Suspense fallback={<div className={styles.skeleton} aria-hidden="true" />}>
        {/* The rule is right about the pattern and wrong about this case: `load`
            returns the same lazy component for a given id on every call, memoised
            inside the registry, precisely so a clock does not remount every render.
            `registry.test.ts` pins that identity. */}
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Widget settings={resolved.settings} size={size} isEditing={isEditing} />
      </Suspense>
    );
  }

  return (
    <div
      className={styles.frame}
      data-widget-type={instance.type}
      data-instance-id={instance.instanceId}
      style={{
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        padding: `${padding}px`,
        justifyContent: JUSTIFY[frame.align],
      }}
    >
      {/* The card is two layers, so that no element has both `opacity` and
          `backdrop-filter`. Opacity below 1 makes an element a backdrop root, which
          browsers render inconsistently with a blur. Instead the blur fades by its
          radius, and the surface by its opacity. */}
      {frame.showBackground && (
        <>
          <div
            className={styles.blur}
            aria-hidden="true"
            style={{
              backdropFilter: `blur(calc(var(--sp-surface-blur, 0px) * ${fade}))`,
            }}
          />
          <div
            className={styles.surface}
            aria-hidden="true"
            style={fade < 1 ? { opacity: fade } : undefined}
          />
        </>
      )}
      <div className={styles.body} style={fade < 1 ? { opacity: fade } : undefined}>
        <WidgetErrorBoundary
          // Remounting on a settings change gives a widget that failed on bad input a
          // genuine second chance once the input is fixed, without a manual retry.
          resetKey={`${instance.type}:${JSON.stringify(instance.settings)}`}
          name={definition?.name ?? instance.type}
          onRemove={isEditing ? onRemove : undefined}
        >
          {content}
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}

/**
 * A card's inner padding, in proportion to the cell. A fixed pixel padding was too
 * much for a one-row widget and too little for a large one: the grid is relative, so
 * the cell's size is the window's, not a number the user chose.
 */
export function cardPadding(box: { width: number; height: number }): number {
  return Math.round(Math.min(16, Math.max(4, Math.min(box.width, box.height) * 0.12)));
}

const JUSTIFY = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
} as const;

function FrameNotice({
  title,
  detail,
  onRemove,
}: {
  title: string;
  detail: string;
  onRemove?: () => void;
}) {
  return (
    <div className={styles.notice} role="status">
      <strong className={styles.noticeTitle}>{title}</strong>
      <span className={styles.noticeDetail}>{detail}</span>
      {onRemove && (
        <button type="button" className={styles.noticeAction} onClick={onRemove}>
          Remove
        </button>
      )}
    </div>
  );
}

interface BoundaryProps {
  children: ReactNode;
  name: string;
  resetKey: string;
  onRemove?: () => void;
}

interface BoundaryState {
  error: Error | null;
  /** Bumped by Retry; remounts the subtree by changing its key. */
  attempt: number;
  resetKey: string;
}

class WidgetErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = {
    error: null,
    attempt: 0,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    if (props.resetKey === state.resetKey) return null;
    return { resetKey: props.resetKey, error: null };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // One line, once, naming the widget. A widget that fails every render must not be
    // able to fill the console and bury everything else.
    console.error(
      `[stillpoint] widget "${this.props.name}" failed to render`,
      error,
      info.componentStack,
    );
  }

  override render() {
    if (!this.state.error) {
      return (
        <div key={this.state.attempt} className={styles.content}>
          {this.props.children}
        </div>
      );
    }

    return (
      <div className={styles.notice} role="alert">
        <strong className={styles.noticeTitle}>{this.props.name} failed</strong>
        <span className={styles.noticeDetail}>{this.state.error.message}</span>
        <span className={styles.noticeActions}>
          <button
            type="button"
            className={styles.noticeAction}
            onClick={() =>
              this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))
            }
          >
            Retry
          </button>
          {this.props.onRemove && (
            <button
              type="button"
              className={styles.noticeAction}
              onClick={this.props.onRemove}
            >
              Remove
            </button>
          )}
        </span>
      </div>
    );
  }
}
