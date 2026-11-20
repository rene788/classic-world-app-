// Vaste lijsten, opmaak en rekenregels die overal in de app gebruikt worden.

export const STATUSES = [['onderweg', 'Onderweg'], ['binnen', 'Binnengekomen'], ['werkplaats', 'In werkplaats'], ['klaar', 'Klaar voor verkoop'], ['verkocht', 'Verkocht']];
export const STL = Object.fromEntries(STATUSES);
export const LOCATIES = [['werkplaats', 'Werkplaats'], ['showroom', 'Showroom'], ['loods', 'Externe loods'], ['extern', 'Externe locatie'],
  ...Array.from({ length: 10 }, (_, i) => ['box' + (i + 1), 'Garagebox ' + (i + 1)])];
export const LOCL = Object.fromEntries(LOCATIES);
export const FASES = [['binnenkomst', 'Bij binnenkomst'], ['restauratie', 'Tijdens restauratie'], ['verkoop', 'Klaar voor verkoop'], ['aflevering', 'Bij aflevering'], ['document', 'Documenten']];
export const PART_ST = [['nodig', 'Nodig'], ['besteld', 'Besteld'], ['binnen', 'Binnen']];
export const KOST_SOORT = [['derden', 'Werk door derden'], ['transport', 'Transport'], ['keuring', 'Keuring en papieren'], ['onderdelen', 'Onderdelen (zonder factuur)'], ['overig', 'Overig']];
export const ORDER_ST = [['besteld', 'Besteld'], ['geleverd', 'Geleverd'], ['betaald', 'Betaald']];
export const UITKOMST = [['geinformeerd', 'Geïnformeerd'], ['interesse', 'Interesse'], ['komt-kijken', 'Komt kijken'], ['proefrit', 'Proefrit gepland'], ['bod', 'Heeft een bod gedaan'], ['te-duur', 'Te duur'], ['geen-interesse', 'Geen interesse'], ['gekocht', 'Gekocht']];
export const UITL = Object.fromEntries(UITKOMST);
export const KANAAL = ['Telefoon', 'E-mail', 'WhatsApp', 'Bezoek'];
export const AANBOD_ST = [['nieuw', 'Nieuw'], ['interessant', 'Interessant'], ['afgewezen', 'Afgewezen'], ['ingekocht', 'Ingekocht']];
export const BESTEMMING = [['nl', 'Nederland'], ['eu', 'Binnen de EU'], ['buiten', 'Buiten de EU']];
export const ROLLEN = [['beheerder', 'Beheerder'], ['verkoop', 'Verkoop'], ['monteur', 'Monteur'], ['meekijker', 'Meekijker'], ['geblokkeerd', 'Geblokkeerd']];
export const ROLL = Object.fromEntries(ROLLEN);
export const CHECK_DEFAULT = {
  nl: ['Koopovereenkomst getekend', 'Volledige betaling ontvangen', 'Overschrijving bij RDW gedaan', 'Sleutels, kentekenbewijs en historie overhandigd', "Foto's bij aflevering gemaakt"],
  eu: ['Koopovereenkomst getekend', 'Volledige betaling ontvangen', 'Btw-nummer koper gecontroleerd (bij zakelijke koper)', 'Voertuig bij RDW afgemeld voor export', 'Transport geboekt', 'Vrachtbrief (CMR) getekend retour ontvangen', "Foto's en conditierapport bij vertrek gemaakt"],
  buiten: ['Koopovereenkomst getekend', 'Volledige betaling ontvangen', "Foto's en conditierapport bij vertrek gemaakt", 'Exportaangifte ingediend (MRN ontvangen)', 'Uitgangsbevestiging ontvangen en bewaard', 'Voertuig bij RDW afgemeld voor export', 'BPM-teruggaaf aangevraagd (indien van toepassing)', 'Transport en verscheping geboekt', 'Transportverzekering geregeld', 'Documenten voor het importland meegegeven'],
};

// ---------- rollen ----------
export const isBeheerder = (r) => r === 'beheerder';
export const zietGeld = (r) => r === 'beheerder' || r === 'verkoop';
export const magWerken = (r) => ['beheerder', 'verkoop', 'monteur'].includes(r);

// ---------- opmaak ----------
const pad = (n) => String(n).padStart(2, '0');
export const isoD = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => isoD(new Date());
export const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoD(d); };
export const fmtD = (s) => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return `${+d}-${+m}-${y}`; };
export const eur = (n) => (n || n === 0) ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '';
export const eur2 = (n) => (n || n === 0) ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n) : '';
export const km = (n) => (n || n === 0) ? new Intl.NumberFormat('nl-NL').format(n) + ' km' : '';
export const hrs = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
export const daysSince = (s) => s ? Math.max(0, Math.round((new Date(today()) - new Date(String(s).slice(0, 10))) / 864e5)) : null;
export const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const carName = (c) => [c.merk, c.model, c.type].filter(Boolean).join(' ') || 'Naamloze auto';
export const carLabel = (c) => (c.voorraadnr ? '#' + c.voorraadnr + ' · ' : '') + carName(c);
export const elapsed = (start) => { const m = Math.max(0, Math.floor((Date.now() - new Date(start)) / 6e4)); return Math.floor(m / 60) + ':' + pad(m % 60); };

// Getallen zoals mensen ze typen: "12.500", "12500,50", "€ 12.500"
export const num = (x) => {
  if (x === '' || x == null) return null;
  const s = String(x).trim().replace(/\s|€/g, '');
  if (!s) return null;
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/[.,](?=\d{3}(\D|$))/g, ''));
  return isFinite(n) ? n : null;
};
export const numDec = (x) => { if (x === '' || x == null) return null; const n = Number(String(x).replace(',', '.')); return isFinite(n) ? n : null; };
export const int = (x) => { const n = num(x); return n == null ? null : Math.round(n); };

export function nextNr(autos) {
  let best = null;
  for (const c of autos) { const m = String(c.voorraadnr || '').match(/^(.*?)(\d+)$/); if (m && (!best || +m[2] > +best[2])) best = m; }
  if (!best) return '';
  return best[1] + String(+best[2] + 1).padStart(best[2].length, '0');
}

export function periodRange(p) {
  const d = new Date();
  if (p === 'week') { const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const e = new Date(s); e.setDate(s.getDate() + 6); return [isoD(s), isoD(e)]; }
  if (p === 'vorigeweek') { const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); const e = new Date(s); e.setDate(s.getDate() + 6); return [isoD(s), isoD(e)]; }
  if (p === 'maand') return [isoD(new Date(d.getFullYear(), d.getMonth(), 1)), isoD(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  if (p === 'vorigemaand') return [isoD(new Date(d.getFullYear(), d.getMonth() - 1, 1)), isoD(new Date(d.getFullYear(), d.getMonth(), 0))];
  if (p === 'kwartaal') { const q = Math.floor(d.getMonth() / 3) * 3; return [isoD(new Date(d.getFullYear(), q, 1)), isoD(new Date(d.getFullYear(), q + 3, 0))]; }
  if (p === 'jaar') return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
  return ['0000-01-01', '9999-12-31'];
}

// ---------- foutmeldingen in gewone taal ----------
export function errText(e) {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if (/invalid login credentials/i.test(m)) return 'E-mailadres of wachtwoord klopt niet.';
  if (/email not confirmed/i.test(m)) return 'Dit account is nog niet bevestigd. Vraag de beheerder om het te bevestigen.';
  if (/row-level security|permission denied|42501/i.test(m) || (e && e.code === '42501')) return 'Dit mag jouw account niet. Vraag het aan de beheerder.';
  if (/autos_voorraadnr_key|duplicate key.*voorraadnr/i.test(m)) return 'Dit voorraadnummer bestaat al.';
  if (/minstens één beheerder/i.test(m)) return 'Er moet minstens één beheerder blijven.';
  if (/Alleen de beheerder/i.test(m)) return m;
  if (/failed to fetch|network|load failed/i.test(m)) return 'Geen verbinding. Controleer je internet en probeer opnieuw.';
  if (/payload too large|exceeded the maximum/i.test(m)) return 'Dit bestand is te groot.';
  if (/password should be at least/i.test(m)) return 'Het wachtwoord moet minstens 8 tekens zijn.';
  if (/rate limit|too many/i.test(m)) return 'Even te veel tegelijk. Wacht een minuut en probeer opnieuw.';
  return 'Dat lukte niet: ' + m;
}

// ---------- matches klantwens ↔ auto ----------
export function wishText(w) {
  const p = [w.merk, w.model, w.type].filter(Boolean).join(' ');
  const y = w.jaar_van && w.jaar_tot ? ` ${w.jaar_van}–${w.jaar_tot}` : w.jaar_van ? ` vanaf ${w.jaar_van}` : w.jaar_tot ? ` t/m ${w.jaar_tot}` : '';
  return (p || 'Elke auto') + y + (w.max_prijs ? `, max ${eur(w.max_prijs)}` : '');
}
// Woorden vergelijken als hele woorden, ook als letters en cijfers aan elkaar staan:
// "3.0SC" wordt "3 0 sc", "911E" wordt "911 e". Zo matcht "SC" niet meer met "porSChe".
const tokens = (s) => norm(String(s || '').replace(/([a-z])(\d)/gi, '$1 $2').replace(/(\d)([a-z])/gi, '$1 $2'));
export function wishMatch(w, c, prijs) {
  if (!w.merk && !w.model && !w.type) return null;
  const t = ' ' + tokens([c.merk, c.model, c.type].join(' ')) + ' ';
  for (const f of ['merk', 'model', 'type']) {
    if (w[f] && !String(w[f]).split(/\s+/).map(tokens).filter(Boolean).every((k) => t.includes(' ' + k + ' '))) return null;
  }
  if (c.bouwjaar) { if (w.jaar_van && c.bouwjaar < w.jaar_van) return null; if (w.jaar_tot && c.bouwjaar > w.jaar_tot) return null; }
  let over = false;
  if (w.max_prijs && prijs && prijs > w.max_prijs) { if (prijs > w.max_prijs * 1.15) return null; over = true; }
  return { wish: w, over };
}
export function bestMatch(wensen, c, prijs) {
  let best = null;
  for (const w of wensen) { const m = wishMatch(w, c, prijs); if (m && (!best || (best.over && !m.over))) best = m; }
  return best;
}

// ---------- kosten en marge per auto ----------
export function carCost(c, d) {
  const f = d.finByAuto[c.id] || {};
  const kosten = sum(d.kosten.filter((x) => x.auto_id === c.id), (x) => x.bedrag);
  const ords = d.bestellingen.filter((x) => x.auto_id === c.id);
  const hs = d.uren.filter((h) => h.auto_id === c.id);
  const facturen = sum(ords.filter((x) => !x.voor_klant), (x) => x.bedrag);
  const klantFacturen = sum(ords.filter((x) => x.voor_klant), (x) => x.bedrag);
  const uren = sum(hs.filter((h) => !h.voor_klant), (h) => h.uren);
  const klantUren = sum(hs.filter((h) => h.voor_klant), (h) => h.uren);
  const tarief = Number(d.settings.uurtarief) || 0;
  const tariefKlant = Number(d.settings.uurtarief_klant) || tarief;
  const arbeid = uren * tarief;
  const inkoop = Number(f.inkoopprijs) || 0;
  const totaal = inkoop + kosten + facturen + arbeid;
  const verkocht = c.status === 'verkocht' && f.verkoopprijs != null;
  const prijs = verkocht ? Number(f.verkoopprijs) : (f.vraagprijs != null ? Number(f.vraagprijs) : null);
  const marge = prijs ? prijs - totaal : null;
  const btw = f.regeling !== 'btw' && marge > 0 ? marge * 21 / 121 : 0;
  return { f, kosten, facturen, uren, tarief, arbeid, inkoop, totaal, prijs, verkocht, marge, btw, netto: marge != null ? marge - btw : null,
    klantUren, klantFacturen, tariefKlant, klantArbeid: klantUren * tariefKlant };
}

// Foto's verkleinen voor upload (scheelt opslag en laadtijd)
export async function shrink(file, max = 2000) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}
// Kleine JPEG voor de profielfoto in lijsten (max 640 px, meestal 30-60 KB)
export async function thumb(file, max = 640) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.8));
  if (!blob) throw new Error('Deze foto kon niet worden gelezen.');
  return new File([blob], 'profiel.jpg', { type: 'image/jpeg' });
}
export const safeName = (n) => norm(n.replace(/\.[^.]+$/, '')).replace(/ /g, '-').slice(0, 40) + (n.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() || '');
export const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
