import React, { useEffect, useRef } from 'react';

// Écran en « Consulter » (droits d'accès) : on peut lire, filtrer, ouvrir, imprimer, mais pas saisir.
// Les champs de saisie et les boutons d'action sont désactivés, y compris ceux qui apparaissent ensuite.
// Restent utilisables : onglets, sections repliables, listes de choix (filtres), recherche, et les boutons
// de lecture (Voir, Ouvrir, Imprimer, Exporter…). Le serveur applique la même règle de son côté.
const KEEP_BUTTON = /^\s*(voir|ouvrir|fermer|imprimer|exporter|télécharger|aperçu|afficher|masquer|précédent|suivant|retour|tout voir|détail)/i;

function lock(root) {
  root.querySelectorAll('input, textarea, button').forEach((el) => {
    if (el.disabled) return;
    if (el.tagName === 'BUTTON' && (el.getAttribute('role') === 'tab' || el.hasAttribute('aria-expanded') || KEEP_BUTTON.test(el.textContent))) return;
    if (el.tagName === 'INPUT' && (el.type === 'search' || /recherch/i.test(`${el.placeholder} ${el.getAttribute('aria-label') ?? ''}`))) return;
    el.disabled = true;
    el.dataset.readonlyLocked = '';
  });
}

export default function ReadOnlyGuard({ active, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const root = ref.current;
    lock(root);
    const obs = new MutationObserver(() => lock(root));
    obs.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    return () => obs.disconnect();
  }, [active]);
  return <div ref={ref}>{children}</div>;
}
