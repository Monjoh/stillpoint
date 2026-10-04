import { referralUrl } from '@/core/unsplash/state';
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
export function UnsplashCredit({ credit }: { credit: Credit }) {
  return (
    <p className={styles.credit}>
      Photo by{' '}
      {credit.profileUrl ? (
        <a href={referralUrl(credit.profileUrl)} target="_blank" rel="noreferrer">
          {credit.name}
        </a>
      ) : (
        credit.name
      )}{' '}
      on{' '}
      <a href={referralUrl(credit.pageUrl)} target="_blank" rel="noreferrer">
        Unsplash
      </a>
    </p>
  );
}
