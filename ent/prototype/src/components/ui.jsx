import React from 'react';

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  navy: 'bg-navy-50 text-navy-700 ring-navy-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function Badge({ tone = 'slate', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone = 'slate' }) {
  const color = { slate: 'text-slate-900', green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700' }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Progress({ value, tone = 'navy' }) {
  const bar = { navy: 'bg-navy-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-navy-500 text-white hover:bg-navy-700 disabled:bg-slate-300',
    secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-300',
    ghost: 'text-navy-700 hover:bg-navy-50',
  }[variant];
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

// Jeu d'icônes minimal (traits 1.75px, 20×20)
const PATHS = {
  home: 'M3 10.5 10 4l7 6.5V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z',
  wallet: 'M3 6h14v10H3zM3 6l10-3v3M13 11h2',
  calendar: 'M4 5h12v12H4zM4 9h12M8 3v4M12 3v4',
  pen: 'M4 16l1-4 8-8 3 3-8 8zM12 5l3 3',
  megaphone: 'M3 8v4h3l6 4V4L6 8zM15 7a3 3 0 0 1 0 6',
  cap: 'M2 8l8-4 8 4-8 4zM5 9.5V14c3 2 7 2 10 0V9.5',
  users: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 17c0-3 2-5 5-5s5 2 5 5M14 4a3 3 0 0 1 0 5M15 12c2 0 3 2 3 5',
  swap: 'M4 7h11l-3-3M16 13H5l3 3',
  alert: 'M10 3l8 14H2zM10 8v4M10 14.5v.5',
  check: 'M4 10l4 4 8-8',
  x: 'M5 5l10 10M15 5L5 15',
  sparkles: 'M10 3l1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5zM16 14l.7 1.3L18 16l-1.3.7L16 18l-.7-1.3L14 16l1.3-.7z',
  settings: 'M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4',
  bell: 'M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13zM8 18h4',
  pin: 'M10 18s6-5.5 6-10a6 6 0 0 0-12 0c0 4.5 6 10 6 10zM10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clock: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 6v4l3 2',
};

export function Icon({ name, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * Choix d'un élève dans une liste déroulante, avec Précédent / Suivant :
 * plus pratique qu'une longue liste à faire défiler pour une classe de 30.
 * `suffix(s)` ajoute un repère au nom (ex. « ✓ validée »).
 */
export function StudentSelect({ students, value, onChange, suffix, label = 'Élève' }) {
  const i = students.indexOf(value);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
        {label}
        <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900">
          {students.map((s) => <option key={s} value={s}>{s}{suffix ? suffix(s) : ''}</option>)}
        </select>
      </label>
      <div className="flex gap-1">
        <Button variant="secondary" aria-label="Élève précédent" disabled={i <= 0} onClick={() => onChange(students[i - 1])}>‹</Button>
        <Button variant="secondary" aria-label="Élève suivant" disabled={i >= students.length - 1} onClick={() => onChange(students[i + 1])}>›</Button>
      </div>
      <span className="pb-2 text-xs tabular-nums text-slate-500">{i + 1} / {students.length}</span>
    </div>
  );
}
