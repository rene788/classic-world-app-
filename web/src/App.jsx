import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db, TABLES } from './db';
import { AppCtx } from './ui';
import { ROLL, zietGeld, isBeheerder, magWerken, errText, bestMatch } from './lib';
import Login, { NieuwWachtwoord } from './views/Login';
import Overzicht from './views/Overzicht';
import Voorraad from './views/Voorraad';
import MijnWerk from './views/MijnWerk';
import Uren from './views/Uren';
import Klanten, { Matches } from './views/Klanten';
import Bestellingen from './views/Bestellingen';
import Aanbod from './views/Aanbod';
import Beheer from './views/Beheer';

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
      if (c.status === 'verkocht') return [];
      const out = [];
      for (const k of raw.klanten) {
        const m = bestMatch(wensenByKlant[k.id] || [], c, prijsOf(c));
        if (m) out.push({ klant: k, ...m, informed: informed.has(k.id + '|' + c.id) });
      }
      return out.sort((a, b) => (a.informed - b.informed) || a.klant.naam.localeCompare(b.klant.naam, 'nl'));
    };
    return { ...raw, finByAuto, settings, names, autoById, boxen, wensenByKlant, prijsOf, matchesForCar };
  }, [raw]);

  const act = useCallback(async (fn, ok, tables) => {
    try {
      const r = await fn(db);
      if (ok) toast(ok);
      if (tables) reload(tables);
      return r === undefined ? true : r;
    } catch (e) { toast(errText(e), true); return false; }
  }, [reload, toast]);

  const tabs = !rol ? [] : zietGeld(rol)
    ? ['overzicht', 'voorraad', 'werk', 'matches', 'klanten', 'aanbod', 'bestellingen', 'uren', ...(isBeheerder(rol) ? ['beheer'] : [])]
    : rol === 'monteur' ? ['werk', 'voorraad', 'uren'] : rol === 'meekijker' ? ['voorraad'] : [];
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

  const openMatches = zietGeld(rol) ? raw.autos.reduce((n, c) => n + d.matchesForCar(c).filter((m) => !m.informed).length, 0) : 0;
  const teKeuren = zietGeld(rol) ? raw.uren.filter((h) => h.status === 'ingediend').length : 0;
  const labels = {
    overzicht: ['Overzicht'], voorraad: ['Voorraad', raw.autos.filter((c) => c.status !== 'verkocht').length],
    werk: ['Mijn werk'], matches: ['Matches', openMatches || null, true], klanten: ['Klanten', raw.klanten.length],
    aanbod: ['Gevonden aanbod', raw.aanbod.filter((x) => x.status === 'nieuw').length || null, true],
    bestellingen: ['Bestellingen'], uren: [rol === 'monteur' ? 'Mijn uren' : 'Uren', isBeheerder(rol) && teKeuren ? teKeuren : null, true],
    beheer: ['Beheer'],
  };

  const ctx = { d, raw, me, rol, uid, email, act, reload, toast, go, openCar, openKlant, nav, setNav,
    geld: zietGeld(rol), beheerder: isBeheerder(rol), werker: magWerken(rol) };

  const View = { overzicht: Overzicht, voorraad: Voorraad, werk: MijnWerk, matches: Matches, klanten: Klanten,
    aanbod: Aanbod, bestellingen: Bestellingen, uren: Uren, beheer: Beheer }[view];

  return (
    <AppCtx.Provider value={ctx}>
      <header className="top"><div className="top-in">
        <div className="brand">
          <h1>Classics World Werkplaats</h1>
          {me && <span className="role">{ROLL[rol]} · {me.naam || email}</span>}
          {zietGeld(rol) && (
            <form className="hsearch" onSubmit={zoek} role="search">
              <input className="in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dossier: voorraadnr, chassis of kenteken" aria-label="Dossier zoeken" />
            </form>
          )}
          <button className="btn ghost sm" style={zietGeld(rol) ? undefined : { marginLeft: 'auto' }} onClick={() => db.signOut()}>Uitloggen</button>
        </div>
        <nav className="tabs" role="tablist">
          {tabs.map((t) => {
            const [label, n, hot] = labels[t];
            return (
              <button key={t} className="tab" role="tab" aria-selected={view === t} onClick={() => go(t, t === 'voorraad' ? { carId: null } : t === 'klanten' ? { klantId: null } : {})}>
                {label}{n != null && <span className={`count num${hot && n ? ' hot' : ''}`}>{n}</span>}
              </button>
            );
          })}
        </nav>
      </div></header>
      <main>
        {loadErr && <div className="banner warn">{loadErr}</div>}
        {!loaded ? <div className="pane"><div className="empty"><p>Gegevens laden…</p></div></div>
          : !me ? <div className="pane"><div className="empty"><h2>Je account heeft nog geen profiel</h2><p>Vraag de beheerder om je account opnieuw aan te maken, of voer het database-script nog een keer uit.</p></div></div>
          : rol === 'geblokkeerd' ? <div className="pane"><div className="empty"><h2>Geen toegang</h2><p>Je account is geblokkeerd. Neem contact op met de beheerder.</p></div></div>
          : <>
            {rol === 'meekijker' && <div className="banner">Je kijkt mee zonder rechten om iets aan te passen. Vraag de beheerder om je een rol te geven.</div>}
            <View />
          </>}
      </main>
      {toastMsg && <div className={`toast${toastMsg.err ? ' err' : ''}`} role="status">{toastMsg.msg}</div>}
    </AppCtx.Provider>
  );
}
