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

  // The content box the widget actually gets, which is what `WidgetProps.size` means.
  const size = {
    width: Math.max(0, box.width - frame.padding * 2),
    height: Math.max(0, box.height - frame.padding * 2),
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
        padding: `${frame.padding}px`,
        opacity: frame.opacity,
        justifyContent: JUSTIFY[frame.align],
        ...(frame.showBackground
          ? {
              background: 'var(--sp-surface)',
              border: '1px solid var(--sp-surface-border)',
              borderRadius: 'var(--sp-radius)',
            }
          : null),
      }}
    >
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
  );
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
