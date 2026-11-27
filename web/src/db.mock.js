// Nagebootste database voor tests zonder Supabase (alleen gebruikt met MOCK=1).
// Rol kiezen: ?rol=beheerder|verkoop|monteur|meekijker in de adresbalk.
const rol = new URLSearchParams(location.search).get('rol') || 'beheerder';
const ids = { beheerder: 'u-beh', verkoop: 'u-ver', monteur: 'u-mon', meekijker: 'u-kijk' };
const me = ids[rol];
const KEYS = { auto_financien: 'auto_id', klokken: 'monteur_id', boxen: 'locatie', instellingen: 'sleutel', gezien: 'auto_id' };
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
    { id: 'a8', voorraadnr: '2026-201', soort: 'consignatie', chassisnr: '9119300412', kenteken: 'GZ-31-PR', merk: 'Porsche', model: '911', type: 'SC Targa', bouwjaar: 1979, kleur: 'Grand Prix Weiss', km: 98000, status: 'klaar', locatie: 'showroom', datum_binnen: d0(25), aangemaakt: d0(25) },
    { id: 'a5', voorraadnr: null, chassisnr: 'WDB1130441A000123', kenteken: 'DK-55-12', merk: 'Mercedes-Benz', model: '280 SL', type: 'Pagode', bouwjaar: 1969, kleur: 'Papyrusweiß', km: 99000, status: 'binnen', locatie: 'spuiterij-jansen', locatie_info: 'Lakwerk motorkap', locatie_sinds: d0(38), datum_binnen: d0(2), aangemaakt: d0(2) },
  ],
  auto_financien: [
    { auto_id: 'a8', vraagprijs: 64900, regeling: 'marge', cons_eigenaar: 'c1', cons_afspraak: 'provisie_pct', cons_waarde: 8, cons_tot: d0(-10) },
    { auto_id: 'a7', inkoopprijs: 41000, vraagprijs: 52900, regeling: 'marge' },
    { auto_id: 'a1', inkoopprijs: 78000, vraagprijs: 112500, regeling: 'marge' },
    { auto_id: 'a2', inkoopprijs: 64000, vraagprijs: 89500, regeling: 'marge' },
    { auto_id: 'a4', inkoopprijs: 70000, vraagprijs: 95000, verkoopprijs: 92000, regeling: 'marge' },
  ],
  taken: [
    { id: 't1', auto_id: 'a1', tekst: 'Remmen rondom nalopen', toegewezen_aan: 'u-mon', deadline: d0(2), klaar: false, volgorde: 0, aangemaakt: d0(10) },
    { id: 't2', auto_id: 'a1', tekst: 'Kap afstellen', monteur: null, klaar: true, klaar_door: 'u-mon', klaar_op: d0(3), volgorde: 1, aangemaakt: d0(10) },
    { id: 't3', auto_id: 'a3', tekst: 'Conditierapport maken', monteur: 'Kees', klaar: false, volgorde: 0, aangemaakt: d0(4) },
    { id: 't5', auto_id: 'a3', tekst: 'Koppelingsplaten vervangen', uitleg: 'Koppeling slipt bij optrekken in 3e', voorstel: 'open', voorgesteld_door: 'u-mon', schatting_uren: 6, schatting_eur: 420, klaar: false, volgorde: 1, aangemaakt: d0(1) },
    { id: 't4', auto_id: null, tekst: 'Onderdelen ophalen bij Rose Passion', toegewezen_aan: 'u-ver', deadline: d0(-1), klaar: false, volgorde: 0, aangemaakt: d0(1) },
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
  wijzigingen: [
    { id: 1, auto_id: 'a1', wie: 'u-mon', soort: 'taak', tekst: 'Taak afgerond: Kap afstellen', aangemaakt: d0(3) },
    { id: 2, auto_id: 'a1', wie: 'u-ver', soort: 'onderdeel', tekst: 'Onderdeel besteld: Remschijven voor', aangemaakt: d0(2) },
    { id: 3, auto_id: 'a3', wie: 'u-mon', soort: 'taak', tekst: 'Voorstel: Koppelingsplaten vervangen', aangemaakt: d0(1) },
    { id: 4, auto_id: 'a2', wie: 'u-beh', soort: 'status', tekst: 'Status: In werkplaats → Klaar voor verkoop', aangemaakt: d0(1) },
    { id: 5, auto_id: 'a2', wie: 'u-beh', soort: 'locatie', tekst: 'Verplaatst naar Showroom', aangemaakt: d0(1) },
    { id: 6, auto_id: 'a8', wie: 'u-ver', soort: 'auto', tekst: 'Nieuwe auto toegevoegd', aangemaakt: d0(2) },
  ],
  gezien: [],
  reparaties: [
    { id: 'r1', nr: 1, klant_naam: 'Piet Mulder', telefoon: '06 2222 3333', auto: 'Porsche 911 SC Coupé 1981', kenteken: '45-XG-12', omschrijving: 'Olielek motor, kleppendeksels pakkingen vervangen', status: 'bezig', toegewezen_aan: 'u-mon', binnen_op: d0(3), klaar_voor: d0(-2), uren_geschat: 6, aangemaakt: d0(4) },
    { id: 'r2', nr: 2, klant_naam: 'Ingrid Smit', telefoon: '06 4444 5555', auto: 'Mercedes 280 SL 1969', kenteken: 'DZ-11-AB', omschrijving: 'Remmen rondom nalopen, APK', status: 'wacht', toegewezen_aan: null, binnen_op: d0(6), klaar_voor: d0(-5), uren_geschat: 4, notitie: 'Wacht op remklauwen', aangemaakt: d0(7) },
    { id: 'r3', nr: 3, klant_naam: 'Bas Jansen', telefoon: null, auto: 'Jaguar E-Type S1', kenteken: null, omschrijving: 'Carburateurs afstellen', status: 'aangemeld', toegewezen_aan: null, binnen_op: null, klaar_voor: d0(-10), uren_geschat: 3, aangemaakt: d0(1) },
  ],
  locaties: [
    { id: 'showroom', naam: 'Showroom', soort: 'intern', plekken: 12, volgorde: 10, actief: true },
    { id: 'werkplaats', naam: 'Werkplaats', soort: 'intern', plekken: 5, volgorde: 20, actief: true },
    { id: 'loods', naam: 'Externe loods', soort: 'intern', plekken: null, volgorde: 30, actief: true },
    ...Array.from({ length: 10 }, (_, i) => ({ id: 'box' + (i + 1), naam: 'Garagebox ' + (i + 1), soort: 'box', plekken: null, volgorde: 101 + i, actief: true })),
    { id: 'spuiterij-jansen', naam: 'Spuiterij Jansen', soort: 'extern', plekken: null, volgorde: 800, actief: true },
    { id: 'extern', naam: 'Externe locatie (overig)', soort: 'extern', plekken: null, volgorde: 900, actief: true },
  ],
};

const GELD = ['auto_financien', 'kosten', 'bestellingen', 'afleverlijst', 'klanten', 'zoekwensen', 'contactmomenten', 'aanbod', 'instellingen'];
const visible = (t) => {
  let rows = S[t];
  if (!geld && GELD.includes(t)) return [];
  if (!geld && t === 'uren') rows = rows.filter((h) => h.monteur_id === me);
  if (!geld && t === 'klokken') rows = rows.filter((k) => k.monteur_id === me);
  if (!geld && t === 'media') rows = rows.filter((m) => m.fase !== 'document');
  if (t === 'reparaties' && rol === 'meekijker') return [];
  return rows;
};
const denied = () => { throw Object.assign(new Error('new row violates row-level security policy'), { code: '42501' }); };
const canWrite = (t, op, row) => {
  if (rol === 'beheerder') return true;
  if (rol === 'meekijker') return false;
  if (GELD.includes(t) || t === 'boxen' || t === 'locaties') return geld && t !== 'instellingen';
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
  async rpc(fn, args) {
    await delay();
    if (fn !== 'verplaats_auto') throw new Error('Onbekende functie ' + fn);
    if (!['beheerder', 'verkoop', 'monteur'].includes(rol)) throw new Error('Je hebt geen rechten om auto\'s te verplaatsen');
    const l = args.p_locatie && S.locaties.find((x) => x.id === args.p_locatie && x.actief);
    if (args.p_locatie && !l) throw new Error('Onbekende locatie');
    const a = S.autos.find((x) => x.id === args.p_auto); if (!a) throw new Error('Auto niet gevonden');
    if (a.locatie !== (args.p_locatie || null)) { a.locatie_sinds = args.p_locatie ? new Date().toISOString() : null; S.wijzigingen.unshift({ id: id(), auto_id: a.id, wie: me, soort: 'locatie', tekst: 'Verplaatst naar ' + (l ? l.naam : 'geen locatie'), aangemaakt: new Date().toISOString() }); }
    a.locatie = args.p_locatie || null; a.locatie_info = l && l.soort === 'extern' ? (String(args.p_info || '').trim().slice(0, 120) || null) : null;
    return null;
  },
  async upload(path, file) { await delay(); blobs[path] = URL.createObjectURL(file); return path; },
  async urls(paths) { return Object.fromEntries(paths.filter((p) => blobs[p]).map((p) => [p, blobs[p]])); },
  async removeFile(path) { delete blobs[path]; },
  live() { return () => {}; },
};
