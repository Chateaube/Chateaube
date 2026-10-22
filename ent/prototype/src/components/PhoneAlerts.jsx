import React, { useEffect, useState } from 'react';
import { Button } from './ui.jsx';
import { pushPlan, isQuiet, QUIET } from '../rules/pushPolicy.js';

// Alertes sur le téléphone des parents (application installée) : activées en un geste, puis
// envoyées selon les règles de l'école (urgent tout de suite ; le reste regroupé, jamais de 20h à 7h).
// Dans le prototype, les alertes sont produites par ce téléphone ; en production, par le serveur (Web Push),
// avec l'e-mail de secours si l'alerte n'est pas ouverte en 2 h.

const SENT_KEY = 'ent-push-envoyes-v1';
const loadSent = () => { try { return JSON.parse(localStorage.getItem(SENT_KEY)) ?? []; } catch { return []; } };
const supported = () => typeof window !== 'undefined' && 'Notification' in window;
const hm = (h) => `${Number(h.slice(0, 2))}h`;

async function show(n) {
  const opts = { body: n.body ?? '', tag: n.id, icon: 'icon-192.png', requireInteraction: n.level === 'URGENT' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) { await reg.showNotification(n.text, opts); return; }
  } catch { /* pas de service worker (aperçu) */ }
  try { new Notification(n.text, opts); } catch { /* refusé par le navigateur */ }
}

/** Envoie ce qui n'est pas encore parti (une seule fois par alerte), selon les heures calmes et le regroupement. */
export function deliver(items, nowHm) {
  if (!supported() || Notification.permission !== 'granted') return [];
  const sent = loadSent();
  const { send } = pushPlan(items.filter((i) => !sent.includes(i.id)), nowHm);
  send.forEach(show);
  try { localStorage.setItem(SENT_KEY, JSON.stringify([...sent, ...send.flatMap((n) => n.ids)].slice(-300))); } catch { /* stockage indisponible */ }
  return send;
}

export default function PhoneAlerts({ items = [], nowHm }) {
  const [perm, setPerm] = useState(() => (supported() ? Notification.permission : 'unsupported'));
  const [msg, setMsg] = useState('');
  const key = items.map((i) => i.id).join('|');
  useEffect(() => { if (perm === 'granted') deliver(items, nowHm); }, [perm, key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (perm === 'unsupported') return null;
  const enable = async () => {
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === 'granted') { const s = deliver(items, nowHm); setMsg(s.length ? `${s.length} alerte${s.length > 1 ? 's' : ''} envoyée${s.length > 1 ? 's' : ''}.` : 'Alertes activées.'); }
  };
  if (perm === 'granted') {
    return (
      <p className="rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
        🔔 Alertes activées sur ce téléphone · urgences à toute heure, le reste regroupé et jamais entre {hm(QUIET.from)} et {hm(QUIET.to)}{isQuiet(nowHm) ? ' (heures calmes en ce moment)' : ''}. {msg}
      </p>
    );
  }
  return (
    <div className="rounded-2xl bg-navy-50 p-4 text-sm text-navy-900">
      <p className="font-semibold">Recevoir les alertes sur ce téléphone</p>
      <p className="text-xs text-navy-800">Absence à justifier, passage à l'infirmerie, sanction : vous êtes prévenu·e tout de suite, sans SMS. Rien entre {hm(QUIET.from)} et {hm(QUIET.to)}, sauf urgence.</p>
      {perm === 'denied'
        ? <p className="mt-2 text-xs text-red-800">Les notifications sont bloquées pour l'ENT : autorisez-les dans les réglages du téléphone. Les alertes restent visibles ici et partent aussi par e-mail.</p>
        : <Button className="mt-2 !py-1.5 text-xs" onClick={enable}>Activer les alertes</Button>}
    </div>
  );
}
