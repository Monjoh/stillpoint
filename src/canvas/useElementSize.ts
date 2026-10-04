import { useEffect, useState } from 'react';
import type { Size } from './geometry';

/**
 * Measure an element's content box, and keep measuring it.
 *
 * A ref callback rather than a ref object: the canvas mounts, is measured, and only
 * then can lay anything out, so we need to know the moment the node exists rather than
 * on the effect pass after it.
 *
 * `null` means "not measured yet". Callers must render nothing positioned until they
 * have a size — guessing the viewport and correcting on the next frame is a visible
 * jump on every single new tab.
 */
export function useElementSize<T extends HTMLElement>(): [
  (node: T | null) => void,
  Size | null,
] {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    if (!node) return;

    const measure = (width: number, height: number) => {
      setSize((current) =>
        current && current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };

    const rect = node.getBoundingClientRect();
    measure(rect.width, rect.height);

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      measure(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, size];
}
