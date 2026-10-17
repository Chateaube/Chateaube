import { useEffect, useState } from 'react';

// Protection contre les captures d'écran (profils Vie scolaire, Enseignant, Parent, Élève).
// Un site web ne peut pas INTERDIRE une capture : on masque l'écran en noir dès que la page perd
// le focus (outil de capture, changement d'application, aperçu des applications ouvertes) ou à
// l'appui sur Impr. écran, et on noircit l'impression (pas de filigrane : rien ne doit sortir de l'ENT).
// Le blocage complet se fait dans l'application mobile (Android : FLAG_SECURE, écran noir).
export function useScreenGuard(active) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!active) { setHidden(false); return undefined; }
    const hide = () => setHidden(true);
    const show = () => setHidden(false);
    const onVisibility = () => (document.hidden ? hide() : show());
    const onKey = (e) => {
      if (e.key === 'PrintScreen') {
        hide();
        try { navigator.clipboard?.writeText(''); } catch { /* presse-papiers indisponible */ }
        setTimeout(show, 1500);
      }
    };
    const noContext = (e) => { if (e.target instanceof HTMLImageElement) e.preventDefault(); };
    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keyup', onKey);
    document.addEventListener('contextmenu', noContext);
    return () => {
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keyup', onKey);
      document.removeEventListener('contextmenu', noContext);
    };
  }, [active]);
  return hidden;
}
