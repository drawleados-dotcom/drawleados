import { useEffect, useState, useCallback } from 'react';

/**
 * useMenuLayout — per-user "sidebar" vs "top" menu preference.
 * Persisted in localStorage so the choice survives refresh + tab close.
 * Emits a 'menu-layout-change' window event so any mounted Layout updates immediately.
 */
const KEY = 'drawlead_menu_layout';

export function useMenuLayout() {
  const [layout, setLayoutState] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'top' ? 'top' : 'sidebar';
    } catch { return 'sidebar'; }
  });

  useEffect(() => {
    const handler = () => {
      try {
        setLayoutState(localStorage.getItem(KEY) === 'top' ? 'top' : 'sidebar');
      } catch {}
    };
    window.addEventListener('menu-layout-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('menu-layout-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const setLayout = useCallback((value) => {
    const v = value === 'top' ? 'top' : 'sidebar';
    try { localStorage.setItem(KEY, v); } catch {}
    setLayoutState(v);
    window.dispatchEvent(new Event('menu-layout-change'));
  }, []);

  return { layout, setLayout };
}
