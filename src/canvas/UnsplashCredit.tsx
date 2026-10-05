import { i18n } from '#i18n';
import { referralUrl } from '@/core/unsplash/state';
import { richText } from '@/lib/rich-text';
import type { UnsplashCredit as Credit } from '@/core/unsplash/use-unsplash';
import styles from './UnsplashCredit.module.css';

/**
 * "Photo by … on Unsplash", in the corner.
 *
 * The one piece of Stillpoint's own text on the canvas in view mode, and it is here
 * because Unsplash's API guidelines require it, with links back carrying their
 * referral parameters. Kept as quiet as the requirement allows: small, muted, fully
 * visible on hover or focus.
 */
/** A brand name, the same in every language. */
const UNSPLASH = 'Unsplash';

export function UnsplashCredit({ credit }: { credit: Credit }) {
  return (
    <p className={styles.credit}>
      {richText(i18n.t('credit.photoBy'), {
        name: credit.profileUrl ? (
          <a href={referralUrl(credit.profileUrl)} target="_blank" rel="noreferrer">
            {credit.name}
          </a>
        ) : (
          credit.name
        ),
        unsplash: (
          <a href={referralUrl(credit.pageUrl)} target="_blank" rel="noreferrer">
            {UNSPLASH}
          </a>
        ),
      })}
    </p>
  );
}
