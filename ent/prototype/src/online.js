import { useEffect, useState } from 'react';

// Connexion : l'application installée fonctionne hors ligne en consultation ; ce qui touche
// à l'argent (caisse) demande la connexion pour éviter doublons de reçus et de paiements.
export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}
