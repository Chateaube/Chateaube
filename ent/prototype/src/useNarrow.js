import { useEffect, useState } from 'react';

/** Vrai sur un écran de téléphone (moins de 640 px de large) ; suit les changements d'orientation. */
export function useNarrow() {
  const q = '(max-width: 639px)';
  const [n, setN] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(q).matches));
  useEffect(() => { const m = window.matchMedia?.(q); if (!m) return undefined; const f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return n;
}
