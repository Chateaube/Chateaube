// Contrôle de tous les écrans, à lancer avant chaque mise en ligne : npm run build:app && npm run check:ecrans
// Ouvre l'application construite (ent/index.html) avec un faux serveur Supabase et des élèves FICTIFS, pour les
// quatre profils (Direction, secrétariat, vie scolaire, professeur) ; parcourt chaque rubrique et chaque onglet ;
// signale un écran en erreur, une erreur JavaScript, un écran vide ou un exemple de la démonstration (noms fictifs,
// « 13 octobre »…) qui apparaîtrait sur le vrai site. Code de sortie 1 s'il y a un problème.
// Aucune donnée réelle : les élèves ci-dessous sont inventés.
const { chromium } = require('playwright');
const SB = 'https://kznhazemmybzjlwbqfrc.supabase.co'; const server = new Map(); let clock = 0;
server.set('partage:gestion:ent-s-depenses', { key: 'partage:gestion:ent-s-depenses', kind: 'PARTAGE', value: [{ id: 'tmv1', label: 'DEPENSE TAMATAVE', amount: 1000, date: '2026-11-10', status: 'PAYE', category: 'Autre' }], at: 't0' });
async function ctxFor(b, who) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const now = Math.floor(Date.now() / 1000);
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('x-init')) { sessionStorage.setItem('x-init', '1'); localStorage.setItem('ent-auth', JSON.stringify(s)); } },
    { access_token: 'x', refresh_token: 'y', expires_at: now + 36000, expires_in: 36000, token_type: 'bearer', user: { id: 'a0', aud: 'authenticated' } });
  const sites = who.sites;
  await ctx.route(`${SB}/**`, async (route) => {
    const r = route.request(); const u = new URL(r.url()); const p = u.pathname; const obj = /object/.test(r.headers()['accept'] ?? '');
    const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
    if (p === '/auth/v1/user') return json({ id: 'a0' });
    if (p === '/rest/v1/rpc/ent_my_sites') return json(sites);
    if (p.startsWith('/rest/v1/rpc/')) return json(null);
    if (p === '/rest/v1/app_user') { const row = { id: who.id, first_name: who.name, last_name: 'X', login: 'x', must_change_code: false, user_role: [{ role: who.role, title: who.title }] }; return json(obj ? row : [row]); }
    const vis = (d) => d.kind !== 'PARTAGE' || (d.key.startsWith('partage:TANA:') ? sites.includes('TANA') : sites.includes('TMV'));
    if (p === '/rest/v1/ent_doc' && r.method() === 'GET') {
      const k = u.searchParams.get('key'); const kind = u.searchParams.get('kind');
      if (kind) return json([...server.values()].filter((d) => `eq.${d.kind}` === kind && vis(d)).map((d) => ({ ...d, owner: null, updated_at: d.at ?? 'x' })));
      const d = server.get(k?.slice(3)); if (d && vis(d)) return json(obj ? { value: d.value, updated_at: 'x' } : [{ value: d.value, updated_at: 'x' }]);
      return obj ? route.fulfill({ status: 406, body: '{}' }) : json([]);
    }
    if (p === '/rest/v1/ent_doc' && r.method() === 'POST') {
      const d = JSON.parse(r.postData()); const list = Array.isArray(d) ? d : [d];
      for (const x of list) if (!vis(x) || (x.kind === 'PARTAGE' && !x.key.startsWith(sites.includes('TMV') && !who.dir ? 'partage:' : 'partage:'))) {}
      const bad = list.filter((x) => x.kind === 'PARTAGE' && !vis(x)); if (bad.length) { console.log('REFUS', who.name, bad.map((x) => x.key)); return route.fulfill({ status: 403, body: '{}' }); }
      const upsert = /merge-duplicates/.test(r.headers()['prefer'] ?? '');
      if (!upsert && list.some((x) => server.has(x.key))) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key' }) });
      const out = list.map((x) => { const row = { ...x, at: `t${++clock}` }; server.set(x.key, row); return { key: x.key, updated_at: row.at }; });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(out) });
    }
    if (p === '/rest/v1/ent_doc' && r.method() === 'PATCH') {
      const k = u.searchParams.get('key')?.slice(3); const at = u.searchParams.get('updated_at')?.slice(3); const cur = server.get(k);
      if (!cur || cur.at !== at) return json([]);
      const row = { ...cur, ...JSON.parse(r.postData()), at: `t${++clock}` }; server.set(k, row); return json([{ key: k, updated_at: row.at }]);
    }
    return json([]);
  });
  return ctx;
}
async function accept(m) {
  for (let k = 0; k < 6 && await m.getByRole('button', { name: /à lire/ }).count(); k++) { await m.getByRole('button', { name: /à lire/ }).first().click(); await m.waitForTimeout(100); }
  if (await m.getByText(/je m.engage/).count()) { await m.getByText(/je m.engage/).click(); await m.getByRole('button', { name: 'Continuer' }).click(); await m.waitForTimeout(400); }
}

const IMP = { importedAt: '2026-11-01T00:00:00Z',
  students: [
    { id: '6E-001', number: '6E-001', cls: '6e', lastName: 'RABE', firstName: 'Fy Test', sex: 'F', birthDate: '2014-03-02', guardians: [{ name: 'RABE Papa', phone: '+261340000001', relation: 'Père' }] },
    { id: '3E-001', number: '3E-001', cls: '3e', lastName: 'ZAFY', firstName: 'Lova Test', sex: 'M', birthDate: '2011-05-04', guardians: [] },
    { id: '1ESTMG-001', number: '1ESTMG-001', cls: '1re STMG', lastName: 'SOA', firstName: 'Mamy Test', sex: 'M', birthDate: '2009-01-01', guardians: [] },
    { id: 'TLESTMG-001', number: 'TLESTMG-001', cls: 'Terminale STMG', lastName: 'NAIVO', firstName: 'Kanto Test', sex: 'F', birthDate: '2008-02-02', guardians: [] },
    { id: 'TLEG-001', number: 'TLEG-001', cls: 'Terminale Générale', lastName: 'VOLA', firstName: 'Tiana Test', sex: 'F', birthDate: '2008-06-02', guardians: [], specialties: ['MATHS', 'SVT'] }],
  assignments: [{ name: 'Prof TEST', subjects: ['Mathématiques'], classes: ['6e', '3e'] }],
  timetable: [{ id: 's1', weekday: 1, start: '07:00', end: '09:00', cls: '6e', subject: 'Mathématiques', teacherId: 'Prof TEST', room: 'A1' }],
  payments: { paid: { 'RABE FY TEST': ['INSCRIPTION'] }, movements: [{ id: 'rep1', date: '2026-11-03', time: '08:00', dir: 'IN', nature: 'Encaissement famille', journal: 'ECOLAGE', label: 'Écolage Novembre — RABE Fy Test', method: 'Espèces', amount: 370000, student: 'RABE FY TEST' }] } };
server.set('partage:equipe:ent-import-v1', { key: 'partage:equipe:ent-import-v1', kind: 'PARTAGE', value: (({ payments, ...r }) => r)(IMP), at: 't1' });
server.set('partage:gestion:ent-import-v1#paiements', { key: 'partage:gestion:ent-import-v1#paiements', kind: 'PARTAGE', value: IMP.payments, at: 't1' });
server.set('roster', { key: 'roster', kind: 'ROSTER', value: { students: IMP.students.map(({ cls, lastName, firstName, specialties }) => ({ cls, lastName, firstName, specialties: specialties ?? [] })), services: { p1: [{ subject: 'Mathématiques', classes: ['6e', '3e'] }] }, names: { p1: 'Prof TEST' }, firsts: { p1: 'M. Test' }, sentAt: '2026-11-10' } });
server.set('ecole', { key: 'ecole', kind: 'ECOLE', value: { timetable: IMP.timetable, changes: [], calendar: null, events: [], sentAt: '2026-11-10' } });
const BAD = [/13 octobre|13\/10\/2026|2026-10-13/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /Ranaivo|RAKOTOARISOA Aina|Mme Hanta|Mme Soa|RAZAFY Kanto|RASOA Lova|M\. Be\b/, /Prototype|données fictives|exemples fictifs/i, /en cours de création/];
(async () => {
  const b = await chromium.launch(); const report = [];
  const who = [
    { id: 'p0', name: 'Sheena', role: 'DIRECTION', title: 'Directrice adjointe', sites: ['TMV', 'TANA'] },
    { id: 'b1', name: 'Christophe', role: 'BUREAU', title: '', sites: ['TMV'] },
    { id: 'c1', name: 'Cpe', role: 'VIE_SCOLAIRE', title: '', sites: ['TMV'] },
    { id: 'p1', name: 'Prof', role: 'PROFESSEUR', title: '', sites: ['TMV'] },
  ];
  for (const w of who) {
    const ctx = await ctxFor(b, w); const m = await ctx.newPage(); const errs = [];
    m.on('pageerror', (e) => errs.push(e.message)); m.on('console', (c) => { if (c.type() === 'error' && !/Failed to load resource|favicon/.test(c.text())) errs.push(`console: ${c.text().slice(0, 150)}`); });
    await m.goto(`file://${require('path').resolve(__dirname, '../../index.html')}`); await m.waitForTimeout(3500); await accept(m);
    const items = await m.locator('aside nav button, nav[aria-label] button').allTextContents();
    const labels = [...new Set(items.map((t) => t.trim()).filter((t) => t && t.length < 60))];
    for (const label of labels) {
      const before = errs.length;
      try { await m.locator('aside nav button, nav[aria-label] button').filter({ hasText: label }).first().click({ timeout: 3000 }); } catch { continue; }
      await m.waitForTimeout(700);
      // onglets de l'écran : chacun est ouvert à son tour
      const tabs = await m.locator('main [role=tab]').allTextContents().catch(() => []);
      for (const tab of [...new Set(tabs.map((t) => t.trim()).filter(Boolean))]) {
        const b2 = errs.length;
        try { await m.locator('main [role=tab]').filter({ hasText: tab }).first().click({ timeout: 2000 }); } catch { continue; }
        await m.waitForTimeout(500);
        const t2 = await m.locator('main').innerText().catch(() => '');
        const h2 = BAD.map((re) => (t2.match(re) ?? [])[0]).filter(Boolean);
        const c2 = /n'a pas pu s'afficher|Une erreur|Erreur inattendue|Cet écran rencontre un problème/i.test(t2);
        if (h2.length || c2 || errs.length > b2) report.push(`${w.role} › ${label} › ${tab} : ${[...h2, c2 ? 'ÉCRAN EN ERREUR' : '', ...errs.slice(b2)].filter(Boolean).join(' | ').slice(0, 300)}`);
      }
      const main = await m.locator('main').innerText().catch(() => '');
      const hits = BAD.map((re) => (main.match(re) ?? [])[0]).filter(Boolean);
      const crash = /n'a pas pu s'afficher|Une erreur|Erreur inattendue|Cet écran rencontre un problème/i.test(main);
      if (hits.length || crash || errs.length > before || main.trim().length < 40) report.push(`${w.role} › ${label} : ${[...hits, crash ? 'ÉCRAN EN ERREUR' : '', main.trim().length < 40 ? 'écran presque vide' : '', ...errs.slice(before)].filter(Boolean).join(' | ').slice(0, 300)}`);
    }
    report.push(`— ${w.role} : ${labels.length} rubriques parcourues`);
    await ctx.close();
  }
  console.log(report.join('\n')); await b.close();
  const problems = report.filter((l) => !l.startsWith('— '));
  console.log(problems.length ? `\n${problems.length} problème(s) : à corriger avant de publier.` : '\nAucun problème : tous les écrans s\'ouvrent, sans exemple fictif.');
  process.exit(problems.length ? 1 : 0);
})();
