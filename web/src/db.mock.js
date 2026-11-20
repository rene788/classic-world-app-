// Nagebootste database voor tests zonder Supabase (alleen gebruikt met MOCK=1).
// Rol kiezen: ?rol=beheerder|verkoop|monteur|meekijker in de adresbalk.
const rol = new URLSearchParams(location.search).get('rol') || 'beheerder';
const ids = { beheerder: 'u-beh', verkoop: 'u-ver', monteur: 'u-mon', meekijker: 'u-kijk' };
const me = ids[rol];
const KEYS = { auto_financien: 'auto_id', klokken: 'monteur_id', boxen: 'locatie', instellingen: 'sleutel' };
const keyOf = (t) => KEYS[t] || 'id';
const geld = ['beheerder', 'verkoop'].includes(rol);
const d0 = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
let seq = 1;
const id = () => 'id-' + seq++;

const S = {
  profielen: [
    { id: 'u-beh', email: 'rene@classics-world.test', naam: 'René', rol: 'beheerder', aangemaakt: d0(10) },
    { id: 'u-ver', email: 'sanne@classics-world.test', naam: 'Sanne', rol: 'verkoop', aangemaakt: d0(9) },
    { id: 'u-mon', email: 'kees@classics-world.test', naam: 'Kees', rol: 'monteur', aangemaakt: d0(9) },
    { id: 'u-kijk', email: 'gast@classics-world.test', naam: 'Gast', rol: 'meekijker', aangemaakt: d0(2) },
  ],
  autos: [
    { id: 'a1', voorraadnr: '2026-012', chassisnr: 'WP0ZZZ99ZTS312345', kenteken: 'TJ-422-X', merk: 'Porsche', model: '911', type: '993 Carrera Cabriolet', bouwjaar: 1996, kleur: 'Zwart', km: 118400, status: 'werkplaats', locatie: 'werkplaats', datum_binnen: d0(40), aangemaakt: d0(40) },
    { id: 'a2', voorraadnr: '2026-013', chassisnr: 'WP0ZZZ96ZPS400123', kenteken: 'AB-12-CD', merk: 'Porsche', model: '911', type: '964 Targa', bouwjaar: 1991, kleur: 'Guards Red', km: 154000, status: 'klaar', locatie: 'showroom', doc_link: 'https://example.com/voorraad/2026-013', datum_binnen: d0(120), aangemaakt: d0(120) },
    { id: 'a3', voorraadnr: '2026-014', chassisnr: '57795', kenteken: null, merk: 'Porsche', model: '356', type: 'A T1 Coupé', bouwjaar: 1956, kleur: 'Silbermetallic', km: 82000, status: 'binnen', locatie: 'box3', datum_binnen: d0(5), aangemaakt: d0(5) },
    { id: 'a4', voorraadnr: '2026-009', chassisnr: 'ZFFJA09B000012345', kenteken: 'XX-99-YY', merk: 'Ferrari', model: '308', type: 'GTS', bouwjaar: 1979, kleur: 'Rosso Corsa', km: 61000, status: 'verkocht', locatie: null, datum_binnen: d0(200), verkoopdatum: d0(3), bestemming: 'buiten', aangemaakt: d0(200) },
    { id: 'a6', voorraadnr: '2026-105', chassisnr: null, kenteken: null, merk: 'Porsche', model: '911', type: '3.2 Carrera Coupé', bouwjaar: 1985, kleur: 'Zwart', km: null, status: 'onderweg', locatie: null, locatie_info: 'Transport uit Duitsland', datum_binnen: d0(150), aangemaakt: d0(150) },
    { id: 'a7', voorraadnr: '2026-099', chassisnr: '9113100777', kenteken: null, merk: 'Porsche', model: '911', type: 'T Targa', bouwjaar: 1973, kleur: 'Oranje', km: null, status: 'geannuleerd', locatie: null, geannuleerd_op: d0(6), annuleer_reden: 'Verkoper trok zich terug', datum_binnen: null, aangemaakt: d0(30) },
    { id: 'a5', voorraadnr: null, chassisnr: 'WDB1130441A000123', kenteken: 'DK-55-12', merk: 'Mercedes-Benz', model: '280 SL', type: 'Pagode', bouwjaar: 1969, kleur: 'Papyrusweiß', km: 99000, status: 'binnen', locatie: 'extern', locatie_info: 'Spuiterij Jansen', datum_binnen: d0(2), aangemaakt: d0(2) },
  ],
  auto_financien: [
    { auto_id: 'a7', inkoopprijs: 41000, vraagprijs: 52900, regeling: 'marge' },
    { auto_id: 'a1', inkoopprijs: 78000, vraagprijs: 112500, regeling: 'marge' },
    { auto_id: 'a2', inkoopprijs: 64000, vraagprijs: 89500, regeling: 'marge' },
    { auto_id: 'a4', inkoopprijs: 70000, vraagprijs: 95000, verkoopprijs: 92000, regeling: 'marge' },
  ],
  taken: [
    { id: 't1', auto_id: 'a1', tekst: 'Remmen rondom nalopen', monteur: 'Kees', klaar: false, volgorde: 0, aangemaakt: d0(10) },
    { id: 't2', auto_id: 'a1', tekst: 'Kap afstellen', monteur: null, klaar: true, klaar_door: 'u-mon', klaar_op: d0(3), volgorde: 1, aangemaakt: d0(10) },
    { id: 't3', auto_id: 'a3', tekst: 'Conditierapport maken', monteur: 'Kees', klaar: false, volgorde: 0, aangemaakt: d0(4) },
  ],
  onderdelen: [
    { id: 'o1', auto_id: 'a1', onderdeel: 'Remschijven voor', leverancier: 'Rose Passion', status: 'besteld', verwacht: d0(2), aangemaakt: d0(8) },
    { id: 'o2', auto_id: 'a1', onderdeel: 'Kapmotor', leverancier: null, status: 'nodig', verwacht: null, aangemaakt: d0(1) },
  ],
  uren: [
    { id: 'h1', auto_id: 'a1', monteur_id: 'u-mon', datum: d0(1), uren: 3.5, omschrijving: 'Remmen demonteren', voor_klant: false, status: 'ingediend', aangemaakt: d0(1) },
    { id: 'h2', auto_id: 'a1', monteur_id: 'u-mon', datum: d0(2), uren: 6, omschrijving: 'Kap', voor_klant: false, status: 'goedgekeurd', aangemaakt: d0(2) },
    { id: 'h3', auto_id: 'a2', monteur_id: 'u-ver', datum: d0(2), uren: 1, omschrijving: 'Poetsen voor foto', voor_klant: true, status: 'goedgekeurd', aangemaakt: d0(2) },
  ],
  klokken: [],
  kosten: [{ id: 'k1', auto_id: 'a1', soort: 'transport', omschrijving: 'Transport uit Duitsland', bedrag: 850, datum: d0(40), aangemaakt: d0(40) }, { id: 'k2', auto_id: 'a7', soort: 'keuring', omschrijving: 'Aankoopkeuring', bedrag: 450, datum: d0(10), aangemaakt: d0(10) }],
  bestellingen: [
    { id: 'b1', auto_id: 'a1', leverancier: 'Rose Passion', omschrijving: 'Remschijven + blokken', factuurnr: 'RP-2291', bedrag: 642.5, datum: d0(8), status: 'besteld', voor_klant: false, aangemaakt: d0(8) },
    { id: 'b2', auto_id: null, leverancier: 'Würth', omschrijving: 'Werkplaatsvoorraad', factuurnr: 'W-1', bedrag: 212, datum: d0(4), status: 'betaald', voor_klant: false, aangemaakt: d0(4) },
  ],
  afleverlijst: [{ id: 'l1', auto_id: 'a4', tekst: 'Exportaangifte ingediend (MRN ontvangen)', klaar: false, volgorde: 0 }],
  media: [],
  boxen: [{ locatie: 'box3', vol: true }],
  klanten: [
    { id: 'c1', naam: 'Jan de Vries', telefoon: '06 1234 5678', email: 'jan@example.com', plaats: 'Arnhem', land: 'Nederland' },
    { id: 'c2', naam: 'Hans Becker', telefoon: '+49 170 1234567', email: null, plaats: 'Düsseldorf', land: 'Duitsland' },
  ],
  zoekwensen: [
    { id: 'w1', klant_id: 'c1', merk: 'Porsche', model: null, type: '993 Cabrio', jaar_van: 1994, jaar_tot: 1998, max_prijs: 110000 },
    { id: 'w2', klant_id: 'c2', merk: 'Porsche', model: '911', type: '964', jaar_van: null, jaar_tot: null, max_prijs: null },
  ],
  contactmomenten: [{ id: 'm1', klant_id: 'c2', auto_id: null, datum: d0(1), kanaal: 'Telefoon', uitkomst: 'komt-kijken', afspraak: d0(-4), notitie: 'Wil 964 bekijken', door: 'u-ver', aangemaakt: d0(1) }],
  aanbod: [{ id: 'x1', merk: 'Porsche', model: '911', type: '993 Cabrio', bouwjaar: 1995, prijs: 98000, land: 'Duitsland', bron: 'mobile.de', link: 'https://example.com', status: 'nieuw', aangemaakt: d0(1) }],
  instellingen: [{ sleutel: 'uurtarief', waarde: 55 }, { sleutel: 'uurtarief_klant', waarde: 85 }],
};

const GELD = ['auto_financien', 'kosten', 'bestellingen', 'afleverlijst', 'klanten', 'zoekwensen', 'contactmomenten', 'aanbod', 'instellingen'];
const visible = (t) => {
  let rows = S[t];
  if (!geld && GELD.includes(t)) return [];
  if (!geld && t === 'uren') rows = rows.filter((h) => h.monteur_id === me);
  if (!geld && t === 'klokken') rows = rows.filter((k) => k.monteur_id === me);
  if (!geld && t === 'media') rows = rows.filter((m) => m.fase !== 'document');
  return rows;
};
const denied = () => { throw Object.assign(new Error('new row violates row-level security policy'), { code: '42501' }); };
const canWrite = (t, op, row) => {
  if (rol === 'beheerder') return true;
  if (rol === 'meekijker') return false;
  if (GELD.includes(t) || t === 'boxen') return geld && t !== 'instellingen';
  if (t === 'autos') return geld && op !== 'delete';
  if (t === 'profielen') return op === 'update' && row && row.id === me;
  if (t === 'uren') return op === 'insert' && (geld || (row.monteur_id === me && row.status === 'ingediend'));
  if (t === 'klokken') return row.monteur_id === me;
  return true;
};
const delay = () => new Promise((r) => setTimeout(r, 40));
const listeners = new Set();
const blobs = {};

export const TABLES = Object.keys(S);
export const sb = null;
export const db = {
  async session() { return sessionStorage.getItem('uit') ? null : { user: { id: me, email: S.profielen.find((p) => p.id === me).email } }; },
  onAuth(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  async signIn(email, pw) { await delay(); if (pw !== 'test') throw new Error('Invalid login credentials'); sessionStorage.removeItem('uit'); const s = await db.session(); listeners.forEach((l) => l('SIGNED_IN', s)); return s; },
  async signOut() { sessionStorage.setItem('uit', '1'); listeners.forEach((l) => l('SIGNED_OUT', null)); },
  async resetPassword() { await delay(); },
  async setPassword() { await delay(); },
  async all(t) { await delay(); return visible(t).map((r) => ({ ...r })); },
  async insert(t, row) {
    await delay(); if (!canWrite(t, 'insert', row)) denied();
    if (t === 'autos' && row.voorraadnr && S.autos.some((a) => a.voorraadnr === row.voorraadnr)) throw new Error('duplicate key value violates unique constraint "autos_voorraadnr_key"');
    const r = { [keyOf(t)]: id(), aangemaakt: new Date().toISOString(), ...row };
    if (t === 'contactmomenten') r.door = me;
    if (t === 'media') r.geupload_door = me;
    S[t].push(r); return { ...r };
  },
  async insertMany(t, rows) { const out = []; for (const r of rows) out.push(await db.insert(t, r)); return out; },
  async upsert(t, row) {
    await delay(); if (!canWrite(t, 'insert', row)) denied();
    const k = keyOf(t); const i = S[t].findIndex((r) => r[k] === row[k]);
    if (i >= 0) S[t][i] = { ...S[t][i], ...row }; else S[t].push({ ...row });
    return { ...row };
  },
  async update(t, rid, patch) {
    await delay(); const k = keyOf(t); const i = S[t].findIndex((r) => r[k] === rid);
    if (i < 0 || !canWrite(t, 'update', S[t][i])) denied();
    if (t === 'profielen' && patch.rol && rol !== 'beheerder') throw new Error('Alleen de beheerder kan rollen wijzigen.');
    S[t][i] = { ...S[t][i], ...patch }; return { ...S[t][i] };
  },
  async remove(t, rid) {
    await delay(); const k = keyOf(t); const i = S[t].findIndex((r) => r[k] === rid);
    if (i < 0 || !canWrite(t, 'delete', S[t][i])) denied();
    S[t].splice(i, 1);
  },
  async upload(path, file) { await delay(); blobs[path] = URL.createObjectURL(file); return path; },
  async urls(paths) { return Object.fromEntries(paths.filter((p) => blobs[p]).map((p) => [p, blobs[p]])); },
  async removeFile(path) { delete blobs[path]; },
  live() { return () => {}; },
};
