import { i18n } from '#i18n';
import { useMemo, useState } from 'react';
import type { WidgetProps } from '@/core/registry/types';
import type { QuoteSettings } from './definition';
import { AUTHOR_SCALE, layoutQuote, LINE_HEIGHT } from './layout';
import { pickQuote } from './pick';
import { QUOTES, type Quote } from './quotes';
import styles from './QuoteView.module.css';

export default function QuoteView({ settings, size }: WidgetProps<QuoteSettings>) {
  // Drawn once per mount: the quote stays put for the life of the tab. See `pick.ts`.
  const [opened] = useState(() => ({ at: Date.now(), seed: Math.random() }));

  const pool = useMemo<Quote[]>(() => {
    const mine = settings.mine
      .filter((quote) => quote.text.trim())
      .map((quote) => ({ text: quote.text.trim(), author: quote.author.trim() }));
    return settings.builtIn ? [...QUOTES, ...mine] : mine;
  }, [settings.builtIn, settings.mine]);

  const quote = pickQuote(pool, settings.refresh, opened.at, opened.seed);

  if (!quote) {
    return <p className={styles.empty}>{i18n.t('widget.quote.view.empty')}</p>;
  }

  const layout = layoutQuote({
    text: quote.text,
    hasAuthor: settings.showAuthor && quote.author !== '',
    width: size.width,
    height: size.height,
    maxPx: settings.fontSize,
  });

  return (
    <figure
      className={styles.quote}
      style={{ fontSize: `${layout.fontSize}px`, lineHeight: LINE_HEIGHT }}
    >
      <blockquote
        className={styles.text}
        style={{ fontStyle: settings.style, WebkitLineClamp: layout.maxLines }}
      >
        {quote.text}
      </blockquote>
      {layout.showAuthor && (
        <figcaption className={styles.author} style={{ fontSize: `${AUTHOR_SCALE}em` }}>
          {quote.author}
        </figcaption>
      )}
    </figure>
  );
}
