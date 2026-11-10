import { useEffect, useRef } from 'react';

// Fenêtre modale accessible : focus placé dans la fenêtre à l'ouverture, Tab et Maj+Tab restent dedans,
// Échap ferme, le focus revient où il était (RGAA 7.1, 12.8 / WCAG 2.1.2, 2.4.3).
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModal(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    const box = ref.current;
    const items = () => [...(box?.querySelectorAll(FOCUSABLE) ?? [])];
    (items()[0] ?? box)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const list = items(); if (!list.length) return;
      const first = list[0]; const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}
