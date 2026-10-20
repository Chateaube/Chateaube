// Inventaire du matériel de l'école : mobilier, équipement, fournitures (consommables), trousse de secours.
// Les manuels ont leur propre gestion (prêts aux élèves) ; l'inventaire en montre le bilan.
// Pour chaque article : quantité, combien sont cassés, où il se trouve, factures, seuil de réapprovisionnement.
// Le matériel prêté aux professeurs (vidéoprojecteurs, TV…) y figure aussi ; il se réserve toujours dans « Réservations ».
export const CATEGORIES = ['Mobilier', 'Équipement', 'Fournitures', 'Trousse de secours'];
export const EXPIRY_WARNING_DAYS = 30;

const days = (from, to) => Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 864e5);
export const usable = (it) => it.qty - (it.broken ?? 0);

/** Articles à recommander : en dessous du seuil, cassés, ou bientôt périmés. */
export function inventoryAlerts(items, today) {
  const out = [];
  items.forEach((it) => {
    if (it.min != null && usable(it) <= it.min) out.push({ id: it.id, kind: 'STOCK', text: `${it.name} : ${usable(it)} en état (seuil ${it.min}) — à recommander` });
    if (it.broken > 0) out.push({ id: it.id, kind: 'CASSE', text: `${it.name} : ${it.broken} cassé${it.broken > 1 ? 's' : ''} — réparer ou remplacer` });
    if (it.expires) {
      const d = days(today, it.expires);
      if (d < 0) out.push({ id: it.id, kind: 'PERIME', text: `${it.name} : périmé depuis le ${it.expires.split('-').reverse().join('/')} — à jeter et remplacer` });
      else if (d <= EXPIRY_WARNING_DAYS) out.push({ id: it.id, kind: 'PEREMPTION', text: `${it.name} : périme le ${it.expires.split('-').reverse().join('/')}` });
    }
  });
  return out;
}

/** Signalement de casse : jamais plus que ce qui est en état. */
export function reportBroken(it, n, note, by, at) {
  if (!(n >= 1)) throw new Error('Indiquer combien sont cassés.');
  if (n > usable(it)) throw new Error(`Seulement ${usable(it)} en état.`);
  if (!note?.trim()) throw new Error('Décrire la casse.');
  return { ...it, broken: (it.broken ?? 0) + n, log: [...(it.log ?? []), { at, by, kind: 'CASSE', n, note }] };
}

/** Réparé (revient en état) ou jeté (sort de l'inventaire). */
export function resolveBroken(it, n, how, by, at) {
  if (!(n >= 1) || n > (it.broken ?? 0)) throw new Error('Quantité incorrecte.');
  return { ...it, broken: it.broken - n, qty: how === 'JETE' ? it.qty - n : it.qty, log: [...(it.log ?? []), { at, by, kind: how, n }] };
}

/** Achat : ajoute la quantité et garde la facture (photo ou PDF). Nouvelle date de péremption éventuelle. */
export function addPurchase(it, { n, supplier, price, invoice, expires }, by, at) {
  if (!(n >= 1)) throw new Error('Indiquer la quantité achetée.');
  return { ...it, qty: it.qty + n, expires: expires || it.expires, invoices: [...(it.invoices ?? []), { at, supplier, price, invoice, n }], log: [...(it.log ?? []), { at, by, kind: 'ACHAT', n }] };
}

/** Sortie de stock (un Doliprane donné, une compresse utilisée). */
export function consume(it, n, by, at, note) {
  if (n > usable(it)) throw new Error(`Plus assez de ${it.name}.`);
  return { ...it, qty: it.qty - n, log: [...(it.log ?? []), { at, by, kind: 'UTILISE', n, note }] };
}

/** Correction d'un article (nom, lieu, quantité comptée, seuil, péremption) : gardée dans l'historique. */
export function editItem(it, patch, by, at) {
  const qty = patch.qty == null ? it.qty : Number(patch.qty);
  if (!String(patch.name ?? it.name).trim()) throw new Error('Le nom de l\'article est obligatoire.');
  if (!(qty >= 0)) throw new Error('Quantité incorrecte.');
  if (qty < (it.broken ?? 0)) throw new Error(`Il y a ${it.broken} cassé(s) : la quantité ne peut pas être plus petite.`);
  return { ...it, ...patch, name: String(patch.name ?? it.name).trim(), qty, log: [...(it.log ?? []), { at, by, kind: 'CORRECTION', n: qty - it.qty, note: 'correction de la fiche' }] };
}

/** Utilisations de la trousse de secours (les plus récentes d'abord) : quoi, combien, par qui, pour qui. */
export const usages = (items) => items.flatMap((it) => (it.log ?? []).filter((l) => l.kind === 'UTILISE').map((l) => ({ ...l, item: it.name })))
  .sort((a, b) => String(b.at).localeCompare(String(a.at)));
