import styles from './Background.module.css';

/**
 * The background layer.
 *
 * It paints `var(--sp-background)` rather than reading the profile itself, and that is
 * the point: `boot.ts` sets that variable from the paint cache before React exists,
 * and `applyCanvasTokens` sets it again from the real config once storage resolves.
 * One variable, two writers, no third opinion — so React mounting can never change
 * what is already on screen.
 *
 * It exists as its own element anyway, because M4 needs somewhere to put the blur and
 * dim layers that image and Unsplash backgrounds require, and those cannot live on
 * `body` without blurring the widgets too.
 */
export function Background() {
  return <div className={styles.background} aria-hidden="true" />;
}
