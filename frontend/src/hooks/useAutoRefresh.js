import { useEffect, useRef } from 'react';

/**
 * useAutoRefresh
 *
 * Generic background polling + window-focus / tab-visibility refresh.
 * Pass any number of refetch functions (or an array). The hook will:
 *   - Call each refetcher on a polling interval (default 15s)
 *   - Skip ticks when the tab is hidden (to save resources)
 *   - Force an immediate refetch when the tab becomes visible again
 *   - Force an immediate refetch when the window regains focus
 *
 * Usage:
 *   useAutoRefresh(loadTasks);
 *   useAutoRefresh([loadTasks, loadCounts], { interval: 10000 });
 *   useAutoRefresh(loadTasks, { enabled: !editing }); // pause while editing
 */
export default function useAutoRefresh(refetchers, options = {}) {
  const { interval = 15000, enabled = true } = options;
  const refetchersRef = useRef(refetchers);
  refetchersRef.current = refetchers;

  useEffect(() => {
    if (!enabled) return;

    const runAll = () => {
      const list = Array.isArray(refetchersRef.current)
        ? refetchersRef.current
        : [refetchersRef.current];
      list.forEach((fn) => {
        if (typeof fn === 'function') {
          try {
            fn();
          } catch {
            /* swallow — refresh failures shouldn't break the UI */
          }
        }
      });
    };

    // Background polling — only when tab is visible
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        runAll();
      }
    }, interval);

    // Immediate refresh on tab visibility / window focus
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        runAll();
      }
    };
    const onFocus = () => runAll();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }

    return () => {
      clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
    };
  }, [interval, enabled]);
}
