import React, { useEffect, useRef, useState } from 'react';
import { signOutAndWipe } from '../online/logout.js';
import { Button } from './ui.jsx';

// Poste partagé (accueil, salle des professeurs) : après 30 minutes sans activité (clic, frappe, défilement),
// l'application demande « Toujours là ? ». Sans réponse pendant 1 minute, elle déconnecte et efface l'appareil.
// Si des saisies ne sont pas encore parties (pas de réseau), elle ne déconnecte pas : rien n'est perdu.
// L'activité dans un autre onglet de l'ENT compte aussi.
const IDLE_MS = 30 * 60 * 1000;
const GRACE_S = 60;
const KEY = 'ent-derniere-activite';
const lastSeen = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } }; // absent (nettoyage de l'appareil) : l'onglet fait foi

export default function IdleGuard() {
  const [left, setLeft] = useState(null); // secondes avant déconnexion (fenêtre ouverte), sinon null
  const [kept, setKept] = useState(false); // déconnexion impossible : saisies en attente
  const last = useRef(Date.now());
  useEffect(() => {
    const mark = () => {
      const now = Date.now();
      if (now - last.current < 10000) return; // une écriture toutes les 10 s au plus
      last.current = now;
      try { localStorage.setItem(KEY, String(now)); } catch { /* indisponible */ }
    };
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* indisponible */ }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }));
    const t = setInterval(() => {
      const idle = Date.now() - Math.max(last.current, lastSeen());
      if (idle < IDLE_MS) { setLeft(null); return; }
      const rest = Math.ceil((IDLE_MS + GRACE_S * 1000 - idle) / 1000);
      setLeft(Math.max(0, rest));
    }, 1000);
    return () => { events.forEach((e) => window.removeEventListener(e, mark, { capture: true })); clearInterval(t); };
  }, []);
  useEffect(() => {
    if (left !== 0) return;
    signOutAndWipe(async () => false).then((done) => {
      if (done) return;
      setKept(true); // pas déconnecté : on repart pour 30 minutes
      last.current = Date.now(); try { localStorage.setItem(KEY, String(last.current)); } catch { /* indisponible */ }
      setLeft(null);
    });
  }, [left]);
  const stay = () => { last.current = Date.now(); try { localStorage.setItem(KEY, String(last.current)); } catch { /* indisponible */ } setLeft(null); };
  if (kept && left === null) {
    return (
      <div role="status" className="fixed bottom-4 left-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 shadow-lg ring-1 ring-amber-200">
        Pas de déconnexion automatique : des saisies ne sont pas encore arrivées sur le serveur (réseau ?). Elles partiront dès le retour du réseau.
        <button type="button" className="ml-2 underline" onClick={() => setKept(false)}>Fermer</button>
      </div>
    );
  }
  if (left === null) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl">
        <p id="idle-title" className="text-lg font-semibold text-navy-900">Toujours là ?</p>
        <p className="mt-2 text-sm text-slate-700">Aucune activité depuis 30 minutes. Pour protéger les données, vous serez déconnecté(e) dans <strong className="tabular-nums">{left} s</strong>.</p>
        <Button className="mt-4 w-full" autoFocus onClick={stay}>Je suis là</Button>
      </div>
    </div>
  );
}
