import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db, TABLES } from './db';
import { AppCtx, Modal } from './ui';
import { ROLL, zietGeld, isBeheerder, magWerken, errText, bestMatch, opVoorraad, STATUSES, zetVerbergBedragen } from './lib';
import Login, { NieuwWachtwoord } from './views/Login';
import Overzicht from './views/Overzicht';
import Voorraad from './views/Voorraad';
import MijnWerk from './views/MijnWerk';
import Planning from './views/Planning';
import Uren from './views/Uren';
import Klanten, { Matches } from './views/Klanten';
import Bestellingen from './views/Bestellingen';
import Aanbod from './views/Aanbod';
import Beheer from './views/Beheer';
import SindsDienst, { ongezien } from './views/SindsDienst';
import Reparaties, { repOpen } from './views/Reparaties';
import WerkplaatsTabel, { werkplaatsRijen } from './views/Werkplaats';
import Financien from './views/Financien';
import Rondleiding, { rondleidingAlGezien } from './Rondleiding';

const EMPTY = Object.fromEntries(TABLES.map((t) => [t, []]));

export default function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    db.session().then(setSession);
    return db.onAuth((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
  }, []);

  if (session === undefined) return <div className="login"><p className="note">Laden…</p></div>;
  if (recovery && session) return <NieuwWachtwoord onDone={() => setRecovery(false)} />;
  if (!session) return <Login />;
  return <Werkplaats key={session.user.id} uid={session.user.id} email={session.user.email} />;
}

function Werkplaats({ uid, email }) {
  const [raw, setRaw] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [nav, setNav] = useState({ view: null, carId: null, klantId: null });
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  // Klantmodus: verbergt bedragen en interne gegevens als je het scherm aan een klant laat zien.
  // Wordt per apparaat onthouden, zodat verversen de modus niet uitzet.
  const [klant, setKlantRaw] = useState(() => { try { return JSON.parse(localStorage.getItem('klantmodus')) || null; } catch { return null; } });
  const [klantStart, setKlantStart] = useState(false);
  const [tour, setTour] = useState(false);
  const setKlant = (v) => { setKlantRaw(v); try { if (v) localStorage.setItem('klantmodus', JSON.stringify(v)); else localStorage.removeItem('klantmodus'); } catch { /* geen opslag */ } };
  const pending = useRef(new Set());
  const timer = useRef(null);

  const toast = useCallback((msg, err) => {
    setToastMsg({ msg, err });
    clearTimeout(toast.t);
    toast.t = setTimeout(() => setToastMsg(null), err ? 5000 : 2600);
  }, []);

  const reload = useCallback(async (tables = TABLES) => {
    const list = [].concat(tables);
    const res = await Promise.allSettled(list.map((t) => db.all(t)));
    setRaw((old) => {
      const n = { ...old };
      res.forEach((r, i) => { if (r.status === 'fulfilled') n[list[i]] = r.value; });
      return n;
    });
    const bad = res.find((r) => r.status === 'rejected');
    if (bad) setLoadErr(errText(bad.reason)); else setLoadErr(null);
  }, []);

  useEffect(() => {
    reload().finally(() => setLoaded(true));
    const stop = db.live((t) => {
      if (!TABLES.includes(t)) return;
      pending.current.add(t);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { const ts = [...pending.current]; pending.current.clear(); reload(ts); }, 300);
    });
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => { stop(); window.removeEventListener('focus', onFocus); };
  }, [reload]);

  const me = raw.profielen.find((p) => p.id === uid);
  const rol = me ? me.rol : null;

  const d = useMemo(() => {
    const finByAuto = Object.fromEntries(raw.auto_financien.map((f) => [f.auto_id, f]));
    const settings = Object.fromEntries(raw.instellingen.map((s) => [s.sleutel, s.waarde]));
    const names = Object.fromEntries(raw.profielen.map((p) => [p.id, p.naam || p.email || 'Onbekend']));
    const autoById = Object.fromEntries(raw.autos.map((a) => [a.id, a]));
    const boxen = Object.fromEntries(raw.boxen.map((b) => [b.locatie, b.vol]));
    const wensenByKlant = {};
    raw.zoekwensen.forEach((w) => { (wensenByKlant[w.klant_id] ||= []).push(w); });
    const informed = new Set(raw.contactmomenten.filter((x) => x.auto_id).map((x) => x.klant_id + '|' + x.auto_id));
    const prijsOf = (c) => { const f = finByAuto[c.id]; return f && f.vraagprijs != null ? Number(f.vraagprijs) : null; };
    const matchesForCar = (c) => {
      if (!opVoorraad(c)) return [];
      const out = [];
      for (const k of raw.klanten) {
        const m = bestMatch(wensenByKlant[k.id] || [], c, prijsOf(c));
        if (m) out.push({ klant: k, ...m, informed: informed.has(k.id + '|' + c.id) });
      }
      return out.sort((a, b) => (a.informed - b.informed) || a.klant.naam.localeCompare(b.klant.naam, 'nl'));
    };
    // Voorstellen van monteurs zijn nog geen echte taken: apart houden tot verkoop/beheer akkoord geeft
    const taken = raw.taken.filter((t) => !t.voorstel);
    const voorstellen = raw.taken.filter((t) => t.voorstel);
    return { ...raw, taken, voorstellen, finByAuto, settings, names, autoById, boxen, wensenByKlant, prijsOf, matchesForCar };
  }, [raw]);

  const act = useCallback(async (fn, ok, tables) => {
    try {
      const r = await fn(db);
      if (ok) toast(ok);
      if (tables) reload(tables);
      return r === undefined ? true : r;
    } catch (e) { toast(errText(e), true); return false; }
  }, [reload, toast]);

  // Rondleiding één keer per apparaat vanzelf starten, zodra iemand met een werkende rol binnen is
  const tourKlaar = loaded && !!me && rol !== 'geblokkeerd' && !klant;
  useEffect(() => { if (tourKlaar && !rondleidingAlGezien()) setTour(true); }, [tourKlaar]);

  zetVerbergBedragen(!!klant);
  const showroom = klant && klant.modus !== 'hele';
  const rolTabs = !rol ? [] : zietGeld(rol)
    ? ['overzicht', 'sinds', 'voorraad', 'werk', 'werkplaats', 'planning', 'reparaties', 'matches', 'klanten', 'aanbod', 'bestellingen', 'financien', 'uren', ...(isBeheerder(rol) ? ['beheer'] : [])]
    : rol === 'monteur' ? ['werk', 'sinds', 'werkplaats', 'planning', 'reparaties', 'voorraad', 'uren'] : rol === 'meekijker' ? ['voorraad'] : [];
  // Klantmodus: showroom = alleen voorraad; hele app = alles behalve tabbladen met klantgegevens of inkoopprijzen
  const tabs = showroom ? ['voorraad'] : klant ? rolTabs.filter((t) => !['klanten', 'matches', 'beheer', 'aanbod', 'bestellingen', 'planning', 'sinds', 'werkplaats', 'reparaties', 'financien'].includes(t)) : rolTabs;
  const view = tabs.includes(nav.view) ? nav.view : tabs[0];

  const go = useCallback((v, extra = {}) => { setNav((n) => ({ ...n, view: v, ...extra })); window.scrollTo(0, 0); }, []);
  const openCar = useCallback((id) => go('voorraad', { carId: id }), [go]);
  const openKlant = useCallback((id) => go('klanten', { klantId: id }), [go]);

  const zoek = (e) => {
    e.preventDefault();
    const s = q.trim().replace(/^#/, '').toLowerCase();
    if (!s) return;
    const c = raw.autos.find((a) => (a.voorraadnr || '').toLowerCase() === s)
      || raw.autos.find((a) => (a.chassisnr || '').toLowerCase().includes(s))
      || raw.autos.find((a) => (a.kenteken || '').toLowerCase().replace(/-/g, '') === s.replace(/-/g, ''));
    if (c) { openCar(c.id); setQ(''); } else toast('Geen auto gevonden met dit voorraad-, chassis- of kentekennummer.', true);
  };

  // Aantal klanten (niet auto×klant-paren) dat nog over minstens één passende auto geïnformeerd moet worden.
  const openMatches = zietGeld(rol) ? new Set(raw.autos.flatMap((c) => d.matchesForCar(c).filter((m) => !m.informed).map((m) => m.klant.id))).size : 0;
  const teKeuren = zietGeld(rol) ? raw.uren.filter((h) => h.status === 'ingediend').length : 0;
  const labels = {
    overzicht: ['Dashboard'], voorraad: ['Voorraad', showroom ? raw.autos.filter((c) => klant.statussen.includes(c.status)).length : raw.autos.filter(opVoorraad).length],
    werk: ['Mijn werk', raw.taken.filter((t) => !t.klaar && !t.voorstel && t.toegewezen_aan === uid).length || null], planning: ['Planning', zietGeld(rol) ? raw.taken.filter((t) => t.voorstel === 'open').length || null : null, true], matches: ['Matches', openMatches || null, true], klanten: ['Klanten', raw.klanten.length],
    aanbod: ['Gevonden aanbod', raw.aanbod.filter((x) => x.status === 'nieuw').length || null, true],
    bestellingen: ['Bestellingen'], uren: [rol === 'monteur' ? 'Mijn uren' : 'Uren', isBeheerder(rol) && teKeuren ? teKeuren : null, true],
    beheer: ['Beheer'],
    sinds: ['Wat is er nieuw', magWerken(rol) ? ongezien(d, uid).length || null : null, true],
    werkplaats: ['Werkplaats', magWerken(rol) ? werkplaatsRijen(d).length || null : null],
    reparaties: ['Reparaties', (raw.reparaties || []).filter(repOpen).length || null],
    financien: ['Financiën'],
  };

  const ctx = { d, raw, me, rol, uid, email, act, reload, toast, go, openCar, openKlant, nav, setNav,
    geld: zietGeld(rol) && !klant, beheerder: isBeheerder(rol) && !klant, werker: magWerken(rol) && !klant, klant, showroom };

  const View = { overzicht: Overzicht, voorraad: Voorraad, werk: MijnWerk, planning: Planning, matches: Matches, klanten: Klanten,
    aanbod: Aanbod, bestellingen: Bestellingen, uren: Uren, beheer: Beheer,
    sinds: SindsDienst, werkplaats: WerkplaatsTabel, reparaties: Reparaties, financien: Financien }[view];

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`app${menuOpen ? ' menu-open' : ''}`}>
      <aside className="side" aria-label="Hoofdmenu">
        <div className="side-brand">
          <span className="wordmark">CLASSICS-WORLD</span>
          <span className="sub">Het autodossier</span>
        </div>
        <nav className="side-nav">
          {MENU.map((g) => {
            const items = g.items.filter((t) => tabs.includes(t));
            if (!items.length) return null;
            return (
              <div key={g.kop || 'hoofd'} className="side-groep">
                {g.kop && <div className="side-kop">{g.kop}</div>}
                {items.map((t) => {
                  const [label, n, hot] = labels[t];
                  return (
                    <button key={t} className="side-item" aria-current={view === t ? 'page' : undefined}
                      onClick={() => { setMenuOpen(false); go(t, t === 'voorraad' ? { carId: null } : t === 'klanten' ? { klantId: null } : {}); }}>
                      <Icoon naam={t} /><span className="side-l">{label}</span>{n != null && <span className={`side-n num${hot && n ? ' hot' : ''}`}>{n}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="side-voet">
          {me && rol !== 'geblokkeerd' && !klant && (
            <button className="side-item" onClick={() => { setMenuOpen(false); setTour(true); }} title="Korte uitleg van alle schermen">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>
              <span className="side-l">Rondleiding</span>
            </button>
          )}
          {me && rol !== 'geblokkeerd' && (
            <button className={`side-item km-knop${klant ? ' aan' : ''}`} aria-pressed={!!klant}
              onClick={() => { setMenuOpen(false); if (klant) setKlant(null); else setKlantStart(true); }} title={klant ? 'Klantmodus uitzetten' : 'Laat de app zien zonder prijzen en interne gegevens'}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{klant
                ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>
                : <><path d="M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 4.1-5M9.9 5.2A9 9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2" /><path d="M2 2l20 20" /></>}</svg>
              <span className="side-l">{klant ? 'Klantmodus uit' : 'Bekijk als klant'}</span>
            </button>
          )}
          {me && !klant && (
            <div className="side-user">
              <span className="avatar" aria-hidden="true">{(me.naam || email || '?').trim()[0]?.toUpperCase()}</span>
              <span className="side-user-t"><b>{me.naam || email}</b><small>{ROLL[rol]}</small></span>
              <button className="side-uit" onClick={() => db.signOut()} title="Uitloggen" aria-label="Uitloggen">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              </button>
            </div>
          )}
        </div>
      </aside>
      {menuOpen && <div className="side-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="inhoud">
      <header className="kop">
        <button className="kop-menu" onClick={() => setMenuOpen(true)} aria-label="Menu openen">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <div className="kop-t">
          {view === 'overzicht' && me && !klant && <div className="eyebrow">{new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>}
          <h1>{view === 'overzicht' && me && !klant ? `${groet()} ${(me.naam || '').split(' ')[0]}`.trim() : labels[view]?.[0]}</h1>
        </div>
        {zietGeld(rol) && !klant && (
          <form className="hsearch" onSubmit={zoek} role="search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op voorraadnr, chassis of kenteken" aria-label="Dossier zoeken" />
          </form>
        )}
      </header>
      {klantStart && <KlantmodusStart onClose={() => setKlantStart(false)} onStart={(v) => { setKlant(v); setKlantStart(false); setNav((n) => ({ ...n, view: 'voorraad', carId: null })); }} />}
      <main>
        {loadErr && <div className="banner warn">{loadErr}</div>}
        {!loaded ? <div className="pane"><div className="empty"><p>Gegevens laden…</p></div></div>
          : !me ? <div className="pane"><div className="empty"><h2>Je account heeft nog geen profiel</h2><p>Vraag de beheerder om je account opnieuw aan te maken, of voer het database-script nog een keer uit.</p></div></div>
          : rol === 'geblokkeerd' ? <div className="pane"><div className="empty"><h2>Geen toegang</h2><p>Je account is geblokkeerd. Neem contact op met de beheerder.</p></div></div>
          : <>
            {rol === 'meekijker' && !klant && <div className="banner">Je kijkt mee zonder rechten om iets aan te passen. Vraag de beheerder om je een rol te geven.</div>}
            <View />
          </>}
      </main>
      </div>
      </div>
      {tour && loaded && me && !klant && <Rondleiding tabs={tabs} go={go} klantmodus={rol !== 'geblokkeerd'} onClose={() => setTour(false)} />}
      {toastMsg && <div className={`toast${toastMsg.err ? ' err' : ''}`} role="status">{toastMsg.msg}</div>}
    </AppCtx.Provider>
  );
}

function KlantmodusStart({ onClose, onStart }) {
  const [modus, setModus] = useState('showroom');
  const [prijs, setPrijs] = useState(true);
  const [werk, setWerk] = useState(true);
  const [onderweg, setOnderweg] = useState(false);
  const start = () => onStart({ modus, prijs, statussen: ['klaar', ...(werk ? ['werkplaats', 'binnen'] : []), ...(onderweg ? ['onderweg'] : [])] });
  const label = Object.fromEntries(STATUSES);
  return (
    <Modal title="Klantmodus aanzetten" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" onClick={start}>Klantmodus aan</button></>}>
      <div className="km-modi" role="radiogroup" aria-label="Wat laat je zien?">
        <label className={`km-opt${modus === 'showroom' ? ' sel' : ''}`}><input type="radio" name="km" checked={modus === 'showroom'} onChange={() => setModus('showroom')} /><span><b>Alleen voorraad (showroom)</b><small>Een nette catalogus: foto's en gegevens van de auto's. Verder niets.</small></span></label>
        <label className={`km-opt${modus === 'hele' ? ' sel' : ''}`}><input type="radio" name="km" checked={modus === 'hele'} onChange={() => setModus('hele')} /><span><b>Hele app zonder bedragen</b><small>Je kunt overal doorheen, maar alle bedragen zijn verborgen. Klanten, Matches, Bestellingen, Gevonden aanbod en Beheer blijven weg vanwege privacy en inkoopprijzen. Je kunt niets wijzigen.</small></span></label>
      </div>
      <h3 className="kp-h" style={{ margin: '4px 0 0' }}>Instellingen</h3>
      <label className="km-opt"><input type="checkbox" checked={prijs} onChange={(e) => setPrijs(e.target.checked)} /><span><b>Vraagprijs tonen</b><small>Zonder vinkje zie je ook geen vraagprijs.</small></span></label>
      {modus === 'showroom' && <>
      <div className="km-opt vast"><input type="checkbox" checked disabled /><span><b>{label.klaar}</b><small>Altijd zichtbaar.</small></span></div>
      <label className="km-opt"><input type="checkbox" checked={werk} onChange={(e) => setWerk(e.target.checked)} /><span><b>Ook {label.werkplaats.toLowerCase()} en {label.binnen.toLowerCase()}</b><small>Auto's die binnenkort te koop komen.</small></span></label>
      <label className="km-opt"><input type="checkbox" checked={onderweg} onChange={(e) => setOnderweg(e.target.checked)} /><span><b>Ook {label.onderweg.toLowerCase()}</b><small>Let op: daar zitten ook aankopen bij die nog niet rond zijn.</small></span></label>
      </>}
    </Modal>
  );
}

// Menu in de zijbalk: groepen zoals in het autodossier-ontwerp
const MENU = [
  { items: ['overzicht', 'sinds', 'voorraad', 'klanten', 'matches'] },
  { kop: 'Werkplaats', items: ['werk', 'werkplaats', 'planning', 'reparaties', 'uren', 'bestellingen'] },
  { kop: 'Beheer', items: ['financien', 'aanbod', 'beheer'] },
];
const groet = () => { const h = new Date().getHours(); return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'; };

const ICONEN = {
  overzicht: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  voorraad: <><path d="M3 15l2-5a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 10l2 5v3h-2.5M5.5 18H3v-3m5.5 3h7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
  klanten: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  matches: <><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" /></>,
  werk: <><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></>,
  planning: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M8 13h3M8 17h6" /></>,
  uren: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bestellingen: <><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>,
  aanbod: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M8 11h6M11 8v6" /></>,
  sinds: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  werkplaats: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.1-.4-.4-2.1z" /></>,
  reparaties: <><path d="M4 17V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10" /><path d="M2 17h20M9 21h6M9 9h6M9 13h3" /></>,
  financien: <><path d="M17.5 6.5A7 7 0 1 0 17.5 17.5" /><path d="M4 10h9M4 14h9" /></>,
  beheer: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
};
export function Icoon({ naam, size = 17 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONEN[naam]}</svg>;
}
