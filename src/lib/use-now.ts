import { useEffect, useState } from 'react';

/**
 * The current time, updated on the interval boundary rather than every `intervalMs`
 * from mount. A minute clock armed with a plain interval drifts to showing each minute
 * up to 59 seconds late, which is the kind of wrong that is hard to notice and
 * impossible to unsee.
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        intervalMs - (Date.now() % intervalMs),
      );
    };

    schedule();
    return () => clearTimeout(timer);
  }, [intervalMs]);

  return now;
}
