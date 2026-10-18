import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../ambianceRuntime.js';

// Effet d'ambiance discret : quelques particules (confettis, pétales, feuilles, étoiles) dessinées sur un canvas
// décoratif, au chargement seulement. Accessibilité :
// - rien n'est dessiné si le système demande moins d'animations (prefers-reduced-motion) ;
// - l'animation s'arrête d'elle-même en moins de 5 secondes (WCAG 2.2.2, rien à mettre en pause) ;
// - aria-hidden, pointer-events: none : invisible pour les lecteurs d'écran et jamais devant un clic ;
// - pause quand l'onglet est caché ; une vingtaine de particules au plus.

const DURATION = 4500; // ms
const COUNT = 22;

const SHAPES = {
  confettis: (c, p) => { c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); },
  petales: (c, p) => { c.beginPath(); c.ellipse(0, 0, p.s / 2, p.s / 4, 0, 0, Math.PI * 2); c.fill(); },
  feuilles: (c, p) => { c.beginPath(); c.moveTo(0, -p.s / 2); c.quadraticCurveTo(p.s / 2, 0, 0, p.s / 2); c.quadraticCurveTo(-p.s / 2, 0, 0, -p.s / 2); c.fill(); },
  etoiles: (c, p) => { c.beginPath(); for (let i = 0; i < 10; i += 1) { const r = i % 2 ? p.s / 5 : p.s / 2; const a = (Math.PI / 5) * i - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); },
};

export default function AmbianceEffects({ ambiance, enabled = true }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const motif = ambiance?.motif;
  const active = enabled && !reduced && motif && SHAPES[motif];

  useEffect(() => {
    setDone(false);
    if (!active) return undefined;
    const canvas = ref.current; const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--amb-accent').trim() || '#005baa';
    const colors = [accent, '#ffffff', accent];
    const w = () => window.innerWidth;
    const parts = Array.from({ length: COUNT }, (_, i) => ({
      x: Math.random() * w(), y: -40 + Math.random() * window.innerHeight * 0.45, s: 8 + Math.random() * 8,
      vy: 50 + Math.random() * 60, vx: -15 + Math.random() * 30, rot: Math.random() * 6, vr: -1.5 + Math.random() * 3,
      sway: Math.random() * 6, color: colors[i % colors.length],
    }));
    let start = null; let last = null; let raf = 0; let elapsed = 0;
    const frame = (t) => {
      if (start === null) { start = t; last = t; }
      const dt = Math.min((t - last) / 1000, 0.05); last = t;
      if (!document.hidden) elapsed += dt * 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = Math.max(0, Math.min(0.85, (DURATION - elapsed) / 1200)); // fondu en fin d'animation
      parts.forEach((p) => {
        p.y += p.vy * dt; p.x += (p.vx + Math.sin((elapsed / 600) + p.sway) * 12) * dt; p.rot += p.vr * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        ctx.strokeStyle = 'rgb(0 0 0 / 0.12)'; SHAPES[motif](ctx, p); ctx.restore();
      });
      if (elapsed < DURATION) raf = requestAnimationFrame(frame); else { ctx.clearRect(0, 0, canvas.width, canvas.height); setDone(true); }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [active, motif, ambiance?.id]);

  if (!active || done) return null;
  return <canvas ref={ref} className="amb-effects" aria-hidden="true" />;
}
