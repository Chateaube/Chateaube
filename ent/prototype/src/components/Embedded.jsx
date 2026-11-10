import React, { useEffect, useRef } from 'react';

// Écran affiché à l'intérieur d'un autre (suivi des professeurs, portail des familles) : son titre principal
// devient un sous-titre pour les lecteurs d'écran (un seul titre de niveau 1 par page).
export default function Embedded({ children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const demote = () => el.querySelectorAll('h1:not([aria-level])').forEach((h) => { h.setAttribute('role', 'heading'); h.setAttribute('aria-level', '2'); });
    demote();
    const obs = new MutationObserver(demote); obs.observe(el, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
