import { useEffect, useState } from 'react';
import { useApp, Modal, Sel, Plate, Status, Loc, DelBtn, Field, useUrls, DocLink } from '../ui';
import { werkers, Wie, Deadline, naamVan, VoorstelKaart } from './Planning';
import {
  STATUSES, PART_ST, KOST_SOORT, ORDER_ST, FASES, BESTEMMING, CHECK_DEFAULT, UITL, carName, fmtD, eur, eur2, km, hrs, sum,
  daysSince, num, today, carCost, wishText, isGereserveerd, reserveringVerlopen, shrink, safeName, rid, thumb, opVoorraad, eurVrij, isCons, CONS_AFSPRAAK,
} from '../lib';
import { UrenForm } from './MijnWerk';
import { BestellingForm } from './Bestellingen';
import { ContactForm } from './Klanten';

export default function AutoDossier({ car, onEdit }) {
  const { d, act, setNav, geld, beheerder, klant } = useApp();
  const c = car;
  const dg = daysSince(c.datum_binnen);

  const [annuleer, setAnnuleer] = useState(false);
  const [reserveer, setReserveer] = useState(false);
  const setStatus = (status) => (status === 'geannuleerd' ? setAnnuleer(true) : act((db) => db.update('autos', c.id, { status, ...(c.status === 'geannuleerd' ? { geannuleerd_op: null, annuleer_reden: null } : {}), ...(status === 'verkocht' && !c.verkoopdatum ? { verkoopdatum: today() } : {}), ...(c.status === 'onderweg' && ['binnen', 'werkplaats', 'klaar'].includes(status) ? { datum_binnen: today() } : {}) }), 'Status bijgewerkt', ['autos']));
  const del = async () => { if (await act((db) => db.remove('autos', c.id), 'Auto verwijderd', ['autos'])) setNav((n) => ({ ...n, carId: null })); };

  const [tab, setTab] = useState('overzicht');
  useEffect(() => { setTab('overzicht'); }, [c.id]);
  const prijs = geld ? d.prijsOf(c) : klant?.prijs ? d.prijsOf(c) : null;
  const openTaken = d.taken.filter((t) => t.auto_id === c.id && !t.klaar).length;
  const fin = d.finByAuto[c.id] || {};
  const tabs = [
    ['overzicht', 'Overzicht'],
    ['werkplaats', 'Werkplaats', openTaken || null],
    ['fotos', "Foto's en documenten"],
    ...(geld ? [['kosten', isCons(c) ? 'Consignatie en kosten' : 'Kosten en marge'], ['verkoop', 'Verkoop en aflevering']] : []),
  ];

  return (
    <div className="detail dossier">
      <button className="btn ghost sm back" onClick={() => setNav((n) => ({ ...n, carId: null }))}>← Terug naar lijst</button>
      <Hero c={c}>
        <div className="eyebrow">{[c.voorraadnr && `#${c.voorraadnr}`, !klant && isCons(c) && 'Consignatie', c.bouwjaar].filter(Boolean).join(' · ') || 'Zonder voorraadnummer'}</div>
        <h2 className="d-title">{carName(c)}</h2>
        <dl className="hero-meta">
          <div><dt>Status</dt><dd><Status s={c.status} c={c} /></dd></div>
          {c.kenteken && <div><dt>Kenteken</dt><dd><Plate c={c} /></dd></div>}
          {c.locatie && <div><dt>Locatie</dt><dd><Loc c={c} /></dd></div>}
          {prijs != null && <div><dt>Vraagprijs</dt><dd className="num">{geld ? eur(prijs) : eurVrij(prijs)}</dd></div>}
          {!klant && opVoorraad(c) && c.status !== 'onderweg' && dg != null && <div><dt>Op voorraad</dt><dd className="num">{dg} dagen</dd></div>}
          {!klant && (c.toegewezen_aan || geld) && (
            <div><dt>Hele auto</dt><dd>
              {geld ? <Wie d={d} t={{ ...c, tekst: carName(c) }} onWijzig={(id) => act((db) => db.update('autos', c.id, { toegewezen_aan: id }), id ? `Hele auto voor ${naamVan(d, id)}` : 'Niemand meer verantwoordelijk', ['autos'])} />
                : <Wie d={d} t={c} />}
            </dd></div>
          )}
        </dl>
        <div className="hero-acties">
          {geld && <Sel value={c.status} onChange={setStatus} options={STATUSES} aria-label="Status wijzigen" />}
          {geld && !klant && opVoorraad(c) && <button className={`btn${isGereserveerd(c) ? ' res-aan' : ''}`} onClick={() => setReserveer(true)}>{isGereserveerd(c) ? (reserveringVerlopen(c) ? 'Reservering verlopen' : '✓ Gereserveerd') : 'Reserveren'}</button>}
          {geld && <button className="btn" onClick={onEdit}>Wijzigen</button>}
          <DocLink c={c} edit={geld} />
          {beheerder && <DelBtn onConfirm={del} label="Verwijderen" />}
        </div>
      </Hero>

      <div className="d-tabs" role="tablist" aria-label="Onderdelen van het dossier">
        {tabs.map(([k, l, n]) => (
          <button key={k} className="d-tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n != null && <span className="count num">{n}</span>}</button>
        ))}
      </div>

      {tab === 'overzicht' && (
        <div className="d-grid">
          <div className="stack">
            {c.status === 'geannuleerd' && <div className="banner warn" style={{ margin: 0 }}>Deze aankoop is geannuleerd. De auto telt niet meer mee in de voorraad, de voorraadwaarde of de matches. De bedragen staan op het dashboard bij "Geannuleerde aankopen".</div>}
            {!klant && (
              <section className="sec">
                <h3>Wat je moet weten</h3>
                {c.omschrijving ? <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.omschrijving}</p> : <p className="note" style={{ margin: 0 }}>Nog geen omschrijving.{geld ? ' Vul die in via Wijzigen.' : ''}</p>}
              </section>
            )}
            {geld && <MatchesSec c={c} />}
            <Taken c={c} />
          </div>
          <aside className="gegevens">
            <h3>Gegevens</h3>
            <dl>
              <Fact k="Merk" v={c.merk} />
              <Fact k="Model" v={[c.model, c.type].filter(Boolean).join(' ')} />
              <Fact k="Bouwjaar" v={c.bouwjaar} />
              <Fact k="Kleur" v={c.kleur} />
              <Fact k="Kilometerstand" v={km(c.km)} />
              <Fact k="Kenteken" v={c.kenteken} />
              <Fact k="Chassisnummer" v={c.chassisnr} mono />
              {c.status === 'onderweg'
                ? <Fact k="Onderweg" v={c.locatie_info || 'nog niet binnen'} />
                : !klant && <Fact k="Binnen sinds" v={c.datum_binnen ? fmtD(c.datum_binnen) : ''} />}
              {c.verkoopdatum && <Fact k="Verkocht op" v={fmtD(c.verkoopdatum)} />}
              {geld && isCons(c) && <Fact k="Eigenaar" v={d.klanten.find((x) => x.id === fin.cons_eigenaar)?.naam || 'nog niet ingevuld'} />}
              {geld && isCons(c) && fin.cons_tot && <Fact k="Consignatie tot" v={fmtD(fin.cons_tot)} />}
              {c.status === 'geannuleerd' && <Fact k="Aankoop geannuleerd" v={`${c.geannuleerd_op ? fmtD(c.geannuleerd_op) : 'datum onbekend'}${c.annuleer_reden ? ` · ${c.annuleer_reden}` : ''}`} />}
              {c.bestemming && <Fact k="Bestemming" v={Object.fromEntries(BESTEMMING)[c.bestemming]} />}
              {klant?.prijs && <Fact k="Vraagprijs" v={d.prijsOf(c) != null ? eurVrij(d.prijsOf(c)) : 'Op aanvraag'} />}
            </dl>
          </aside>
        </div>
      )}
      {tab === 'werkplaats' && <div className="stack"><Taken c={c} /><Onderdelen c={c} /><UrenSec c={c} /></div>}
      {tab === 'fotos' && <Media c={c} />}
      {tab === 'kosten' && geld && <Financien c={c} />}
      {tab === 'verkoop' && geld && <div className="stack"><Afleverlijst c={c} /><Contacten c={c} /></div>}
      {annuleer && <AnnuleerForm c={c} onClose={() => setAnnuleer(false)} />}
      {reserveer && <ReserveerForm c={c} onClose={() => setReserveer(false)} />}
    </div>
  );
}

function AnnuleerForm({ c, onClose }) {
  const { act } = useApp();
  const [datum, setDatum] = useState(today());
  const [reden, setReden] = useState('');
  const [busy, setBusy] = useState(false);
  const opslaan = async () => {
    setBusy(true);
    const ok = await act((db) => db.update('autos', c.id, { status: 'geannuleerd', geannuleerd_op: datum || null, annuleer_reden: reden.trim() || null }), 'Aankoop geannuleerd', ['autos']);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal title="Aankoop annuleren" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Terug</button><button className="btn danger" disabled={busy} onClick={opslaan}>{busy ? 'Opslaan…' : 'Aankoop annuleren'}</button></>}>
      <p className="note" style={{ margin: 0 }}>{carName(c)}{c.voorraadnr ? ` · #${c.voorraadnr}` : ''} gaat uit de voorraad. De inkoopprijs en gemaakte kosten blijven bewaard en komen op het overzicht bij "Geannuleerde aankopen". Je kunt dit later terugdraaien door de status weer te wijzigen.</p>
      <Field label="Geannuleerd op"><input className="in" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></Field>
      <Field label="Reden (optioneel)"><input className="in" value={reden} onChange={(e) => setReden(e.target.value)} placeholder="bijv. verkoper trok zich terug, keuring afgekeurd" /></Field>
    </Modal>
  );
}

// Grote foto bovenaan het dossier, met daaroverheen een kaartje met de belangrijkste gegevens
// Auto reserveren voor een klant, optioneel met einddatum. Verkocht of geannuleerd laat de reservering vanzelf vervallen.
function ReserveerForm({ c, onClose }) {
  const { d, act } = useApp();
  const was = isGereserveerd(c);
  const [voor, setVoor] = useState(c.gereserveerd_voor || '');
  const [tot, setTot] = useState(c.gereserveerd_tot || (was ? '' : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)));
  const opslaan = async () => {
    const ok = await act((db) => db.update('autos', c.id, { gereserveerd_op: c.gereserveerd_op || new Date().toISOString(), gereserveerd_voor: voor || null, gereserveerd_tot: tot || null }), was ? 'Reservering bijgewerkt' : 'Auto gereserveerd', ['autos', 'wijzigingen']);
    if (ok) onClose();
  };
  const opheffen = async () => {
    if (await act((db) => db.update('autos', c.id, { gereserveerd_op: null, gereserveerd_voor: null, gereserveerd_tot: null }), 'Reservering opgeheven', ['autos', 'wijzigingen'])) onClose();
  };
  const klanten = [...d.klanten].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  return (
    <Modal title={was ? 'Reservering' : 'Auto reserveren'} onClose={onClose}
      footer={<>
        {was && <button className="btn" style={{ marginRight: 'auto' }} onClick={opheffen}>Reservering opheffen</button>}
        <button className="btn" onClick={onClose}>Annuleren</button>
        <button className="btn primary" onClick={opslaan}>{was ? 'Opslaan' : 'Reserveren'}</button>
      </>}>
      <p className="note" style={{ margin: 0 }}>{carName(c)}{c.voorraadnr ? ` · #${c.voorraadnr}` : ''}{was && c.gereserveerd_op ? ` · gereserveerd sinds ${fmtD(c.gereserveerd_op.slice(0, 10))}` : ''}</p>
      <div className="grid2">
        <Field label="Voor klant (optioneel)"><Sel value={voor} onChange={setVoor} options={klanten.map((k) => [k.id, k.naam])} empty="Geen klant gekozen" /></Field>
        <Field label="Gereserveerd tot (optioneel)"><input className="in" type="date" value={tot} min={today()} onChange={(e) => setTot(e.target.value)} /></Field>
      </div>
      <p className="hint" style={{ margin: 0 }}>De auto blijft op voorraad en krijgt het label "Gereserveerd", ook in de klantmodus (zonder naam). Collega&apos;s zien het bij "Wat is er nieuw". Zet je de status op Verkocht, dan vervalt de reservering vanzelf.</p>
    </Modal>
  );
}

function Hero({ c, children }) {
  const { act, geld } = useApp();
  const urls = useUrls([c.foto]);
  const [busy, setBusy] = useState(false);
  const kies = async (file) => {
    if (!file) return;
    setBusy(true);
    const oud = c.foto;
    const ok = await act(async (db) => {
      const klein = await thumb(file, 1280);
      const pad = `${c.id}/profiel/${rid().slice(0, 8)}.jpg`;
      await db.upload(pad, klein);
      await db.update('autos', c.id, { foto: pad });
    }, 'Profielfoto opgeslagen', ['autos']);
    if (ok && oud) act(async (db) => { try { await db.removeFile(oud); } catch { /* mag blijven staan */ } });
    setBusy(false);
  };
  const weg = () => act(async (db) => { await db.update('autos', c.id, { foto: null }); try { await db.removeFile(c.foto); } catch { /* mag blijven staan */ } }, 'Profielfoto verwijderd', ['autos']);
  return (
    <section className="hero">
      {urls[c.foto] ? <img className="hero-img" src={urls[c.foto]} alt={`Foto ${carName(c)}`} />
        : <div className="hero-leeg"><svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 15l2-5a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 10l2 5v3h-2.5M5.5 18H3v-3m5.5 3h7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg></div>}
      {geld && (
        <div className="hero-foto pfoto-k">
          <label className="btn sm filebtn">{busy ? 'Bezig…' : c.foto ? 'Andere foto' : '+ Profielfoto'}
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => { kies(e.target.files[0]); e.target.value = ''; }} />
          </label>
          {c.foto && !busy && <DelBtn x label="Profielfoto verwijderen" onConfirm={weg} />}
        </div>
      )}
      <div className="hero-kaart">{children}</div>
    </section>
  );
}

const Fact = ({ k, v, mono }) => <div className="fact"><dt>{k}</dt><dd className={mono ? 'mono' : undefined}>{v || '—'}</dd></div>;

// Geïnteresseerde klanten voor deze auto: matches op zoekwens + klanten die bij deze auto interesse hebben getoond.
// Hiermee verzamel je in één keer de e-mailadressen om iedereen (in BCC) te mailen.
const INTERESSE = ['interesse', 'komt-kijken', 'proefrit', 'bod', 'geinformeerd'];
const AFGEHAAKT = ['geen-interesse', 'gekocht'];

export function geinteresseerden(d, c) {
  const per = new Map();
  const laatste = {};
  d.contactmomenten.filter((x) => x.auto_id === c.id).sort((a, b) => (a.datum || '').localeCompare(b.datum || '') || (a.aangemaakt || '').localeCompare(b.aangemaakt || ''))
    .forEach((x) => { laatste[x.klant_id] = x; });
  const informed = new Set(Object.values(laatste).filter((x) => x.uitkomst === 'geinformeerd').map((x) => x.klant_id));
  d.contactmomenten.filter((x) => x.auto_id === c.id && x.uitkomst === 'geinformeerd').forEach((x) => informed.add(x.klant_id));
  for (const m of d.matchesForCar(c)) per.set(m.klant.id, { k: m.klant, zoekt: m.wish, over: m.over, informed: m.informed });
  for (const [kid, x] of Object.entries(laatste)) {
    const k = d.klanten.find((y) => y.id === kid);
    if (!k) continue;
    if (AFGEHAAKT.includes(x.uitkomst)) { per.delete(kid); continue; }
    if (!INTERESSE.includes(x.uitkomst) && !per.has(kid)) continue;
    per.set(kid, { ...(per.get(kid) || { k }), contact: x, informed: informed.has(kid) });
  }
  return [...per.values()].sort((a, b) => (a.informed - b.informed) || a.k.naam.localeCompare(b.k.naam, 'nl'));
}
const geldigMail = (e) => /^[^\s@;,<>]+@[^\s@;,<>]+\.[^\s@;,<>]+$/.test(String(e || '').trim());

function MatchesSec({ c }) {
  const { d, act, openKlant, me } = useApp();
  const lijst = geinteresseerden(d, c);
  // Verbergen wordt per apparaat onthouden en geldt voor alle auto's
  const [verborgen, setVerborgenRaw] = useState(() => { try { return localStorage.getItem('matches-verborgen') === '1'; } catch { return false; } });
  const setVerborgen = (v) => { setVerborgenRaw(v); try { localStorage.setItem('matches-verborgen', v ? '1' : '0'); } catch { /* geen opslag */ } };
  const [uit, setUit] = useState(() => new Set()); // klanten die je uitvinkt
  const [erbij, setErbij] = useState('');
  const [gekopieerd, setGekopieerd] = useState(false);
  if (!opVoorraad(c)) return null;
  const metMail = lijst.filter((x) => geldigMail(x.k.email));
  const zonderMail = lijst.filter((x) => !geldigMail(x.k.email));
  const gekozen = metMail.filter((x) => !uit.has(x.k.id));
  const adressen = [...new Set(gekozen.map((x) => x.k.email.trim().toLowerCase()))];
  const open = lijst.filter((x) => !x.informed).length;
  const wissel = (id) => setUit((u) => { const n = new Set(u); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const inform = (k) => act((db) => db.insert('contactmomenten', { klant_id: k.id, auto_id: c.id, uitkomst: 'geinformeerd', datum: today() }), 'Gemarkeerd als geïnformeerd', ['contactmomenten']);
  const allenInformeren = () => act(async (db) => {
    for (const x of gekozen.filter((y) => !y.informed)) await db.insert('contactmomenten', { klant_id: x.k.id, auto_id: c.id, uitkomst: 'geinformeerd', kanaal: 'E-mail', datum: today() });
  }, `${gekozen.filter((y) => !y.informed).length} klant(en) gemarkeerd als geïnformeerd`, ['contactmomenten']);
  const voegToe = () => { if (!erbij) return; act((db) => db.insert('contactmomenten', { klant_id: erbij, auto_id: c.id, uitkomst: 'interesse', datum: today() }), 'Toegevoegd aan geïnteresseerden', ['contactmomenten']).then((ok) => ok && setErbij('')); };
  const tekst = adressen.join('; ');
  const kopieer = async () => {
    try { await navigator.clipboard.writeText(tekst); setGekopieerd(true); setTimeout(() => setGekopieerd(false), 2500); }
    catch { const t = document.getElementById(`bcc-${c.id}`); if (t) { t.hidden = false; t.select(); } }
  };
  const onderwerp = `${[c.merk, c.model, c.type].filter(Boolean).join(' ')}${c.bouwjaar ? ` (${c.bouwjaar})` : ''} · Classics World`;
  // Eigen adres bij Aan, klanten alleen in BCC: ze zien elkaars adres niet
  const mailto = `mailto:${encodeURIComponent(me?.email || '')}?bcc=${encodeURIComponent(adressen.join(','))}&subject=${encodeURIComponent(onderwerp)}`;
  const teLang = mailto.length > 1900;
  const anderen = d.klanten.filter((k) => !lijst.some((x) => x.k.id === k.id)).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  const waarom = (x) => [x.zoekt && `zoekt ${wishText(x.zoekt)}${x.over ? ' (iets boven budget)' : ''}`, x.contact && `${UITL[x.contact.uitkomst] || 'contact'} · ${fmtD(x.contact.datum)}`].filter(Boolean).join(' · ');

  return (
    <section className="sec">
      <h3 className="sec-h">Geïnteresseerd <span className="aux">{lijst.length ? `${lijst.length} klant${lijst.length === 1 ? '' : 'en'}${open ? ` · ${open} nog te informeren` : ' · iedereen geïnformeerd'}` : 'nog niemand'}</span>
        {lijst.length > 0 && <button className="btn ghost sm" aria-expanded={!verborgen} onClick={() => setVerborgen(!verborgen)}>{verborgen ? `Toon (${lijst.length})` : 'Verbergen'}</button>}
      </h3>
      {!verborgen && <>
        {isGereserveerd(c) && <div className="banner warn" style={{ margin: '0 0 8px' }}>Let op: deze auto is gereserveerd{c.gereserveerd_voor ? ` voor ${d.klanten.find((k) => k.id === c.gereserveerd_voor)?.naam || 'een klant'}` : ''}{c.gereserveerd_tot ? ` tot ${fmtD(c.gereserveerd_tot)}` : ''}. Vermeld dat als je geïnteresseerden mailt.</div>}
        {metMail.length > 0 && (
          <div className="gi-acties">
            <button className="btn primary" onClick={kopieer} disabled={!adressen.length}>{gekopieerd ? '✓ Gekopieerd' : `Kopieer e-mailadressen (${adressen.length})`}</button>
            {teLang ? <span className="note">Te veel adressen voor één mail-knop: kopieer ze en plak ze in BCC.</span>
              : <a className={`btn${adressen.length ? '' : ' uit'}`} href={adressen.length ? mailto : undefined}>Nieuwe mail (BCC)</a>}
            <button className="btn ghost" onClick={allenInformeren} disabled={!gekozen.some((y) => !y.informed)}>Aangevinkte op geïnformeerd</button>
          </div>
        )}
        <textarea id={`bcc-${c.id}`} className="in mono" hidden readOnly rows={2} value={tekst} aria-label="E-mailadressen" />
        {metMail.length > 0 && <p className="note" style={{ margin: '0 0 8px' }}>Plak de adressen altijd in <b>BCC</b>, nooit bij Aan of CC. Dan zien klanten elkaars adres niet.</p>}
        <div className="matchbox">
          {metMail.map((x) => (
            <label key={x.k.id} className={`m-item gi${uit.has(x.k.id) ? ' uit' : ''}`}>
              <input type="checkbox" checked={!uit.has(x.k.id)} onChange={() => wissel(x.k.id)} aria-label={`${x.k.naam} meenemen in de mail`} />
              <div className="m-who">
                <button type="button" className="linkish" onClick={() => openKlant(x.k.id)}>{x.k.naam}</button>
                <div className="m-wish">{waarom(x)}</div>
                <div className="m-wish mono">{x.k.email}</div>
              </div>
              {x.informed ? <span className="chip ok">Geïnformeerd</span> : <button type="button" className="btn sm" onClick={(e) => { e.preventDefault(); inform(x.k); }}>Geïnformeerd</button>}
            </label>
          ))}
          {zonderMail.length > 0 && <div className="gi-kop">Geen e-mailadres, even bellen</div>}
          {zonderMail.map((x) => (
            <div key={x.k.id} className="m-item">
              <div className="m-who">
                <button className="linkish" onClick={() => openKlant(x.k.id)}>{x.k.naam}</button>
                <div className="m-wish">{waarom(x)}</div>
                <div className="m-wish">{x.k.telefoon || 'geen telefoonnummer'}{x.k.email && !geldigMail(x.k.email) ? ` · e-mailadres klopt niet: ${x.k.email}` : ''}</div>
              </div>
              {x.informed ? <span className="chip ok">Geïnformeerd</span> : <button className="btn sm" onClick={() => inform(x.k)}>Geïnformeerd</button>}
            </div>
          ))}
          {!lijst.length && <p className="note" style={{ margin: 0 }}>Nog geen klanten met interesse in deze auto. Klanten met een passende zoekwens verschijnen hier vanzelf.</p>}
        </div>
        {anderen.length > 0 && (
          <div className="gi-erbij">
            <Sel value={erbij} onChange={setErbij} options={anderen.map((k) => [k.id, k.naam + (k.email ? '' : ' (geen e-mail)')])} empty="Klant toevoegen die interesse heeft…" aria-label="Klant toevoegen" />
            <button className="btn sm" disabled={!erbij} onClick={voegToe}>Toevoegen</button>
          </div>
        )}
      </>}
    </section>
  );
}

function Taken({ c }) {
  const { d, act, werker, geld, uid } = useApp();
  const [t, setT] = useState('');
  const [m, setM] = useState(c.toegewezen_aan || '');
  const [dl, setDl] = useState('');
  useEffect(() => { setM(c.toegewezen_aan || ''); }, [c.id, c.toegewezen_aan]);
  const list = d.taken.filter((x) => x.auto_id === c.id).sort((a, b) => (a.klaar - b.klaar) || (a.volgorde - b.volgorde) || (a.aangemaakt || '').localeCompare(b.aangemaakt || ''));
  const done = list.filter((x) => x.klaar).length;
  const add = async (e) => {
    e.preventDefault();
    if (!t.trim()) return;
    const vs = !geld; // monteur: wordt een voorstel dat verkoop/beheer goedkeurt
    if (await act((db) => db.insert('taken', { auto_id: c.id, tekst: t.trim(), toegewezen_aan: m || null, deadline: dl || null, volgorde: list.length, ...(vs ? { voorstel: 'open', voorgesteld_door: uid } : {}) }),
      vs ? 'Voorstel verstuurd. Verkoop of beheer keurt het goed.' : m ? `Taak voor ${naamVan(d, m)}` : null, ['taken'])) { setT(''); setDl(''); }
  };
  const voorstellen = d.voorstellen.filter((x) => x.auto_id === c.id && (x.voorstel === 'open' || geld || x.voorgesteld_door === uid));
  const wijs = (x, id) => act((db) => db.update('taken', x.id, { toegewezen_aan: id }), null, ['taken']);
  const toggle = (x) => act((db) => db.update('taken', x.id, { klaar: !x.klaar, klaar_door: !x.klaar ? uid : null, klaar_op: !x.klaar ? new Date().toISOString() : null }), null, ['taken']);
  return (
    <section className="sec">
      <h3>Takenlijst <span className="aux">{done} van {list.length} klaar</span>{list.length > 0 && <span className="bar"><i style={{ width: `${(done / list.length) * 100}%` }} /></span>}</h3>
      {werker && (
        <form className="add" onSubmit={add}>
          <input className="in" value={t} onChange={(e) => setT(e.target.value)} placeholder={geld ? 'Nieuwe taak, bijv. remmen nalopen' : 'Voorstel, bijv. remschijven vervangen'} aria-label={geld ? 'Nieuwe taak' : 'Voorstel'} />
          <Sel value={m} onChange={setM} empty="Voor wie?" options={werkers(d).map((p) => [p.id, p.naam || p.email])} aria-label="Voor wie" style={{ flex: '0 1 150px' }} />
          <input className="in" type="date" style={{ flex: '0 1 150px' }} value={dl} onChange={(e) => setDl(e.target.value)} aria-label="Klaar voor (optioneel)" title="Klaar voor (optioneel)" />
          <button className="btn">{geld ? 'Toevoegen' : 'Voorstellen'}</button>
        </form>
      )}
      {!list.length ? <p className="note">Nog geen taken.</p> : list.map((x) => (
        <div key={x.id} className={`todo${x.klaar ? ' done' : ''}`}>
          <input type="checkbox" checked={!!x.klaar} disabled={!werker} onChange={() => toggle(x)} aria-label={`Taak ${x.tekst} afvinken`} />
          <span className="t">{x.tekst}{x.uitleg && <span className="note"> — {x.uitleg}</span>}</span>
          <Deadline t={x} />
          {x.klaar ? null : werker ? <Wie d={d} t={x} onWijzig={(id) => wijs(x, id)} /> : <Wie d={d} t={x} />}
          {x.klaar && x.klaar_door && <span className="note">✓ {d.names[x.klaar_door] || ''}{x.klaar_op ? ` · ${fmtD(x.klaar_op)}` : ''}</span>}
          {geld && <DelBtn x onConfirm={() => act((db) => db.remove('taken', x.id), null, ['taken'])} />}
        </div>
      ))}
      {voorstellen.length > 0 && (
        <div className="vs-lijst" style={{ marginTop: 10 }}>
          <h4 className="kp-h" style={{ margin: 0 }}>Voorstellen {geld ? 'om goed te keuren' : ''}</h4>
          {voorstellen.map((x) => <VoorstelKaart key={x.id} t={x} toonAuto={false} />)}
        </div>
      )}
    </section>
  );
}

function Onderdelen({ c }) {
  const { d, act, werker, geld } = useApp();
  const [o, setO] = useState('');
  const [lev, setLev] = useState('');
  const list = d.onderdelen.filter((x) => x.auto_id === c.id).sort((a, b) => (a.aangemaakt || '').localeCompare(b.aangemaakt || ''));
  const add = async (e) => {
    e.preventDefault();
    if (!o.trim()) return;
    if (await act((db) => db.insert('onderdelen', { auto_id: c.id, onderdeel: o.trim(), leverancier: lev.trim() || null }), null, ['onderdelen'])) { setO(''); setLev(''); }
  };
  const upd = (x, patch) => act((db) => db.update('onderdelen', x.id, patch), null, ['onderdelen']);
  return (
    <section className="sec">
      <h3>Onderdelen <span className="aux">{list.filter((x) => x.status !== 'binnen').length} nog niet binnen</span></h3>
      {werker && (
        <form className="add" onSubmit={add}>
          <input className="in" value={o} onChange={(e) => setO(e.target.value)} placeholder="Onderdeel, bijv. remschijven voor" aria-label="Onderdeel" />
          <input className="in" style={{ flex: '0 1 160px' }} value={lev} onChange={(e) => setLev(e.target.value)} placeholder="Leverancier" aria-label="Leverancier" />
          <button className="btn">Toevoegen</button>
        </form>
      )}
      {!list.length ? <p className="note">Nog geen onderdelen.</p> : (
        <div className="tw"><table>
          <thead><tr><th>Onderdeel</th><th>Leverancier</th><th>Status</th><th>Verwacht</th><th /></tr></thead>
          <tbody>{list.map((x) => (
            <tr key={x.id}>
              <td>{x.onderdeel}</td><td>{x.leverancier || '—'}</td>
              <td>{werker ? <Sel value={x.status} onChange={(v) => upd(x, { status: v })} options={PART_ST} aria-label="Status onderdeel" /> : Object.fromEntries(PART_ST)[x.status]}</td>
              <td>{werker ? <input className="in" type="date" style={{ padding: '3px 6px', width: 140 }} value={x.verwacht || ''} onChange={(e) => upd(x, { verwacht: e.target.value || null })} aria-label="Verwachte datum" />
                : fmtD(x.verwacht)}{x.status === 'besteld' && x.verwacht && x.verwacht < today() && <span className="chip bad" style={{ marginLeft: 6 }}>te laat</span>}</td>
              <td className="r">{geld && <DelBtn x onConfirm={() => act((db) => db.remove('onderdelen', x.id), null, ['onderdelen'])} />}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

function UrenSec({ c }) {
  const { d, werker, geld, rol } = useApp();
  const [form, setForm] = useState(false);
  const list = d.uren.filter((h) => h.auto_id === c.id).sort((a, b) => b.datum.localeCompare(a.datum));
  return (
    <section className="sec">
      <h3>{geld ? 'Uren aan deze auto' : 'Mijn uren aan deze auto'} <span className="aux">{hrs(sum(list, (h) => h.uren))} uur{list.some((h) => h.voor_klant) ? `, waarvan ${hrs(sum(list.filter((h) => h.voor_klant), (h) => h.uren))} voor de klant` : ''}</span>
        {werker && <button className="btn sm" onClick={() => setForm(true)}>+ Uren</button>}</h3>
      {!list.length ? <p className="note">Nog geen uren geschreven.</p> : (
        <div className="tw"><table>
          <thead><tr><th>Datum</th>{geld && <th>Monteur</th>}<th className="r">Uren</th><th>Wat</th><th>Status</th></tr></thead>
          <tbody>{list.map((h) => (
            <tr key={h.id}>
              <td>{fmtD(h.datum)}</td>{geld && <td>{d.names[h.monteur_id] || '—'}</td>}
              <td className="r num">{hrs(h.uren)}</td>
              <td>{h.omschrijving || '—'}{h.voor_klant && <span className="chip match" style={{ marginLeft: 6 }}>voor klant</span>}</td>
              <td>{h.status === 'goedgekeurd' ? <span className="chip ok">Goedgekeurd</span> : <span className="chip">Wacht op goedkeuring</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {rol === 'monteur' && <p className="hint" style={{ marginTop: 6 }}>Je ziet alleen je eigen uren. Een fout gemeld? Vraag de beheerder om het aan te passen.</p>}
      {form && <UrenForm carId={c.id} onClose={() => setForm(false)} />}
    </section>
  );
}

function Media({ c }) {
  const { d, act, werker, geld, beheerder, uid, toast } = useApp();
  const [urls, setUrls] = useState({});
  const [fase, setFase] = useState(c.status === 'binnen' || c.status === 'onderweg' ? 'binnenkomst' : c.status === 'klaar' ? 'verkoop' : c.status === 'verkocht' ? 'aflevering' : 'restauratie');
  const [busy, setBusy] = useState(0);
  const [big, setBig] = useState(null);
  const list = d.media.filter((m) => m.auto_id === c.id);
  const key = list.map((m) => m.pad).sort().join('|');

  useEffect(() => {
    let live = true;
    const paths = key ? key.split('|') : [];
    act((db) => db.urls(paths)).then((m) => { if (live && m && typeof m === 'object') setUrls(m); });
    return () => { live = false; };
  }, [key, act]);

  const upload = async (files) => {
    const arr = [...files];
    setBusy(arr.length);
    for (const file0 of arr) {
      const file = await shrink(file0);
      if (file.size > 20 * 1024 * 1024) { toast(`${file.name} is groter dan 20 MB en is overgeslagen.`, true); setBusy((n) => n - 1); continue; }
      const pad = (fase === 'document' ? `geld/${c.id}/` : `${c.id}/${fase}/`) + rid().slice(0, 8) + '-' + safeName(file.name);
      await act(async (db) => { await db.upload(pad, file); await db.insert('media', { auto_id: c.id, fase, pad, naam: file.name, soort: file.type }); });
      setBusy((n) => n - 1);
    }
    act(async () => {}, arr.length > 1 ? `${arr.length} bestanden toegevoegd` : 'Bestand toegevoegd', ['media']);
  };
  const del = (m) => act(async (db) => { await db.remove('media', m.id); try { await db.removeFile(m.pad); } catch { /* bestand al weg */ } }, 'Verwijderd', ['media']);
  const fases = FASES.filter(([k]) => k !== 'document' || geld);

  return (
    <section className="sec">
      <h3>Foto's{geld ? ' en documenten' : ''} <span className="aux">{list.length}</span></h3>
      {werker && (
        <div className="upl">
          <Sel value={fase} onChange={setFase} options={fases} aria-label="Fase" />
          <label className="btn filebtn">{busy ? `Uploaden… (${busy})` : fase === 'document' ? '+ Document' : "+ Foto's"}
            <input type="file" multiple accept={fase === 'document' ? 'image/*,application/pdf' : 'image/*'} disabled={!!busy}
              onChange={(e) => { if (e.target.files.length) upload(e.target.files); e.target.value = ''; }} />
          </label>
        </div>
      )}
      {!list.length ? <p className="note">Nog geen foto's.</p> : fases.map(([k, l]) => {
        const items = list.filter((m) => m.fase === k);
        if (!items.length) return null;
        const imgs = items.filter((m) => (m.soort || '').startsWith('image/'));
        const docs = items.filter((m) => !(m.soort || '').startsWith('image/'));
        return (
          <div key={k}>
            <div className="fase">{l}</div>
            {imgs.length > 0 && <div className="gal">{imgs.map((m) => (
              <div key={m.id} className="ph">
                {urls[m.pad] ? <img src={urls[m.pad]} alt={m.naam || 'Foto'} loading="lazy" onClick={() => setBig(m)} /> : null}
                {(beheerder || m.geupload_door === uid) && <DelBtn x label="Foto verwijderen" onConfirm={() => del(m)} />}
              </div>
            ))}</div>}
            {docs.map((m) => (
              <div key={m.id} className="doc">
                <span className="chip">PDF</span>
                {urls[m.pad] ? <a href={urls[m.pad]} target="_blank" rel="noreferrer">{m.naam || 'Document'}</a> : <span>{m.naam}</span>}
                {(beheerder || m.geupload_door === uid) && <DelBtn x onConfirm={() => del(m)} />}
              </div>
            ))}
          </div>
        );
      })}
      {big && (
        <div className="scrim" onClick={() => setBig(null)}>
          <div className="lightbox"><img src={urls[big.pad]} alt={big.naam || 'Foto'} /></div>
        </div>
      )}
    </section>
  );
}

function Financien({ c }) {
  const { d, act } = useApp();
  const k = carCost(c, d);
  const f = k.f;
  const [kost, setKost] = useState(null);
  const [best, setBest] = useState(null);
  const [vk, setVk] = useState(f.verkoopprijs ?? '');
  useEffect(() => { setVk(f.verkoopprijs ?? ''); }, [f.verkoopprijs]);

  const saveFin = (patch) => act((db) => db.upsert('auto_financien', { auto_id: c.id, inkoopprijs: f.inkoopprijs ?? null, vraagprijs: f.vraagprijs ?? null, regeling: f.regeling || 'marge', verkoopprijs: f.verkoopprijs ?? null,
    cons_eigenaar: f.cons_eigenaar ?? null, cons_afspraak: f.cons_afspraak ?? null, cons_waarde: f.cons_waarde ?? null, cons_tot: f.cons_tot ?? null, cons_afgerekend: f.cons_afgerekend ?? false, ...patch }), 'Opgeslagen', ['auto_financien']);
  const [cw, setCw] = useState(f.cons_waarde ?? '');
  useEffect(() => { setCw(f.cons_waarde ?? ''); }, [f.cons_waarde]);
  const kosten = d.kosten.filter((x) => x.auto_id === c.id).sort((a, b) => b.datum.localeCompare(a.datum));
  const ords = d.bestellingen.filter((x) => x.auto_id === c.id).sort((a, b) => b.datum.localeCompare(a.datum));

  return (
    <section className="sec">
      <h3>{k.cons ? 'Consignatie en kosten' : 'Kosten en marge'} <span className="aux">alleen zichtbaar voor verkoop en beheerder</span></h3>
      {k.cons && <>
        <div className="grid2" style={{ marginBottom: 12 }}>
          <Field label="Eigenaar"><Sel value={f.cons_eigenaar} onChange={(v) => saveFin({ cons_eigenaar: v || null })} empty="Kies een klant"
            options={[...d.klanten].sort((a, b) => (a.naam || '').localeCompare(b.naam || '')).map((x) => [x.id, x.naam])} /></Field>
          <Field label="Afspraak"><Sel value={f.cons_afspraak} onChange={(v) => saveFin({ cons_afspraak: v || null })} empty="Nog geen afspraak" options={CONS_AFSPRAAK} /></Field>
          <Field label={f.cons_afspraak === 'provisie_pct' ? 'Provisie (%)' : f.cons_afspraak === 'netto_eigenaar' ? 'Bedrag voor de eigenaar (€)' : 'Provisie (€)'}>
            <input className="in" inputMode="decimal" value={cw} disabled={!f.cons_afspraak} onChange={(e) => setCw(e.target.value)} onBlur={() => { if (num(cw) !== (f.cons_waarde ?? null)) saveFin({ cons_waarde: num(cw) }); }} />
          </Field>
          <Field label="Consignatie loopt tot"><input className="in" type="date" value={f.cons_tot || ''} onChange={(e) => saveFin({ cons_tot: e.target.value || null })} /></Field>
        </div>
        {!d.klanten.length && <p className="hint">Zet de eigenaar eerst als klant in de app; dan kun je hem hier kiezen.</p>}
      </>}
      <div className="grid2" style={{ marginBottom: 12 }}>
        <Field label="Verkoopprijs (bij verkoop)">
          <input className="in" inputMode="decimal" value={vk} onChange={(e) => setVk(e.target.value)} onBlur={() => { if (num(vk) !== (f.verkoopprijs ?? null)) saveFin({ verkoopprijs: num(vk) }); }} />
        </Field>
        {!k.cons && <Field label="Btw-regeling">
          <Sel value={f.regeling || 'marge'} onChange={(v) => saveFin({ regeling: v })} options={[['marge', 'Margeregeling'], ['btw', 'Btw-auto (21% over verkoopprijs)']]} />
        </Field>}
      </div>
      {k.cons ? (
        <div className="ledger">
          <Row l={k.verkocht ? 'Verkoopprijs' : 'Vraagprijs'} v={k.prijs != null ? eur2(k.prijs) : '—'} />
          <Row l="Voor de eigenaar" v={k.eigenaarKrijgt != null ? eur2(k.eigenaarKrijgt) : '—'} />
          <Row l="Onze provisie" v={k.verdienste != null ? eur2(k.verdienste) : '—'} cls="total" />
          <Row l={`Eigen kosten (${kosten.length}) en facturen`} v={eur2(k.kosten + k.facturen)} />
          <Row l={`Eigen arbeid: ${hrs(k.uren)} uur × ${eur2(k.tarief)}`} v={eur2(k.arbeid)} />
          {k.marge != null && <Row l="Resultaat voor ons" v={<span className={k.marge >= 0 ? 'pos' : 'neg'}>{eur2(k.marge)}</span>} cls="total big" />}
        </div>
      ) : <>
      <div className="ledger">
        <Row l="Inkoopprijs" v={eur2(k.inkoop)} />
        <Row l={`Kosten (${kosten.length})`} v={eur2(k.kosten)} />
        <Row l={`Facturen en bestellingen (${ords.filter((x) => !x.voor_klant).length})`} v={eur2(k.facturen)} />
        <Row l={`Arbeid: ${hrs(k.uren)} uur × ${eur2(k.tarief)}`} v={eur2(k.arbeid)} />
        <Row l="Totaal geïnvesteerd" v={eur2(k.totaal)} cls="total" />
        <Row l={k.verkocht ? 'Verkoopprijs' : 'Vraagprijs'} v={k.prijs ? eur2(k.prijs) : '—'} />
        {k.marge != null && <Row l="Brutomarge" v={<span className={k.marge >= 0 ? 'pos' : 'neg'}>{eur2(k.marge)}</span>} cls="total big" />}
        {k.marge != null && f.regeling !== 'btw' && k.btw > 0 && <Row l="Waarvan btw margeregeling (21/121)" v={eur2(k.btw)} />}
        {k.netto != null && f.regeling !== 'btw' && <Row l="Nettomarge na btw" v={eur2(k.netto)} cls="total" />}
      </div>
      </>}
      {k.cons && c.status === 'verkocht' && (
        <label className="chk" style={{ marginTop: 10 }}><input type="checkbox" checked={!!f.cons_afgerekend} onChange={(e) => saveFin({ cons_afgerekend: e.target.checked })} /> Afgerekend met de eigenaar{k.eigenaarKrijgt != null ? ` (${eur2(k.eigenaarKrijgt)}${k.klantArbeid + k.klantFacturen ? `, min ${eur2(k.klantArbeid + k.klantFacturen)} doorbelaste kosten` : ''})` : ''}</label>
      )}
      {!k.tarief && <p className="hint" style={{ marginTop: 6 }}>Het interne uurtarief staat op € 0. De beheerder stelt het in bij Beheer.</p>}
      {(k.klantUren > 0 || k.klantFacturen > 0) && (
        <div className="ledger" style={{ marginTop: 12 }}>
          <Row l={`Voor de klant: ${hrs(k.klantUren)} uur × ${eur2(k.tariefKlant)}`} v={eur2(k.klantArbeid)} />
          <Row l="Voor de klant: bestellingen" v={eur2(k.klantFacturen)} />
          <Row l={k.cons ? 'Door te belasten aan de eigenaar' : 'Door te belasten aan klant'} v={eur2(k.klantArbeid + k.klantFacturen)} cls="total" />
        </div>
      )}

      <h3 style={{ marginTop: 18 }}>Kosten <button className="btn sm" onClick={() => setKost({})}>+ Kosten</button></h3>
      {!kosten.length ? <p className="note">Geen losse kosten.</p> : (
        <div className="tw"><table>
          <thead><tr><th>Datum</th><th>Soort</th><th>Omschrijving</th><th className="r">Bedrag</th><th /></tr></thead>
          <tbody>{kosten.map((x) => (
            <tr key={x.id}><td>{fmtD(x.datum)}</td><td>{Object.fromEntries(KOST_SOORT)[x.soort]}</td><td>{x.omschrijving || '—'}</td>
              <td className="r num">{eur2(x.bedrag)}</td><td className="r"><DelBtn x onConfirm={() => act((db) => db.remove('kosten', x.id), null, ['kosten'])} /></td></tr>
          ))}</tbody>
        </table></div>
      )}

      <h3 style={{ marginTop: 18 }}>Bestellingen en facturen <button className="btn sm" onClick={() => setBest({ auto_id: c.id })}>+ Bestelling</button></h3>
      {!ords.length ? <p className="note">Geen bestellingen aan deze auto gekoppeld.</p> : (
        <div className="tw"><table>
          <thead><tr><th>Datum</th><th>Leverancier</th><th>Omschrijving</th><th>Status</th><th className="r">Bedrag</th></tr></thead>
          <tbody>{ords.map((x) => (
            <tr key={x.id} className="click" onClick={() => setBest(x)}><td>{fmtD(x.datum)}</td><td>{x.leverancier || '—'}</td>
              <td>{x.omschrijving || '—'}{x.voor_klant && <span className="chip match" style={{ marginLeft: 6 }}>voor klant</span>}</td>
              <td>{Object.fromEntries(ORDER_ST)[x.status]}</td><td className="r num">{eur2(x.bedrag)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      {kost && <KostForm c={c} onClose={() => setKost(null)} />}
      {best && <BestellingForm order={best.id ? best : null} preset={best} onClose={() => setBest(null)} />}
    </section>
  );
}
const Row = ({ l, v, cls }) => <div className={`ledger-row${cls ? ' ' + cls : ''}`}><span>{l}</span><span className="num">{v}</span></div>;

function KostForm({ c, onClose }) {
  const { act } = useApp();
  const [soort, setSoort] = useState('derden');
  const [oms, setOms] = useState('');
  const [bedrag, setBedrag] = useState('');
  const [datum, setDatum] = useState(today());
  const save = async () => {
    const b = num(bedrag);
    if (b == null) return;
    if (await act((db) => db.insert('kosten', { auto_id: c.id, soort, omschrijving: oms.trim() || null, bedrag: b, datum }), 'Kosten toegevoegd', ['kosten'])) onClose();
  };
  return (
    <Modal title="Kosten toevoegen" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" disabled={num(bedrag) == null} onClick={save}>Opslaan</button></>}>
      <div className="grid2">
        <Field label="Soort"><Sel value={soort} onChange={setSoort} options={KOST_SOORT} /></Field>
        <Field label="Bedrag (€)"><input className="in" inputMode="decimal" value={bedrag} onChange={(e) => setBedrag(e.target.value)} autoFocus /></Field>
        <Field label="Datum"><input className="in" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></Field>
      </div>
      <Field label="Omschrijving"><input className="in" value={oms} onChange={(e) => setOms(e.target.value)} placeholder="bijv. spuitwerk Jansen" /></Field>
    </Modal>
  );
}

function Afleverlijst({ c }) {
  const { d, act } = useApp();
  const list = d.afleverlijst.filter((x) => x.auto_id === c.id).sort((a, b) => a.volgorde - b.volgorde);
  const [t, setT] = useState('');
  if (!list.length) {
    if (c.status !== 'verkocht' && c.status !== 'klaar') return null;
    return (
      <section className="sec">
        <h3>Afleverlijst</h3>
        <p className="note" style={{ marginBottom: 8 }}>Maak een checklist voor de aflevering, afhankelijk van waar de auto naartoe gaat.</p>
        <div className="d-actions">{BESTEMMING.map(([k, l]) => (
          <button key={k} className="btn" onClick={() => act((db) => db.insertMany('afleverlijst', CHECK_DEFAULT[k].map((tekst, i) => ({ auto_id: c.id, tekst, volgorde: i }))), 'Afleverlijst gemaakt', ['afleverlijst'])}>{l}</button>
        ))}</div>
      </section>
    );
  }
  const done = list.filter((x) => x.klaar).length;
  return (
    <section className="sec">
      <h3>Afleverlijst <span className="aux">{done} van {list.length} gedaan</span><span className="bar"><i style={{ width: `${(done / list.length) * 100}%` }} /></span></h3>
      {list.map((x) => (
        <div key={x.id} className={`check${x.klaar ? ' done' : ''}`}>
          <input type="checkbox" id={'al' + x.id} checked={!!x.klaar} onChange={() => act((db) => db.update('afleverlijst', x.id, { klaar: !x.klaar }), null, ['afleverlijst'])} />
          <label htmlFor={'al' + x.id}>{x.tekst}</label>
          <DelBtn x onConfirm={() => act((db) => db.remove('afleverlijst', x.id), null, ['afleverlijst'])} />
        </div>
      ))}
      <form className="add" style={{ marginTop: 8 }} onSubmit={async (e) => { e.preventDefault(); if (t.trim() && await act((db) => db.insert('afleverlijst', { auto_id: c.id, tekst: t.trim(), volgorde: list.length }), null, ['afleverlijst'])) setT(''); }}>
        <input className="in" value={t} onChange={(e) => setT(e.target.value)} placeholder="Punt toevoegen" aria-label="Punt toevoegen" /><button className="btn">Toevoegen</button>
      </form>
    </section>
  );
}

function Contacten({ c }) {
  const { d, openKlant } = useApp();
  const [form, setForm] = useState(false);
  const list = d.contactmomenten.filter((x) => x.auto_id === c.id).sort((a, b) => b.datum.localeCompare(a.datum) || (b.aangemaakt || '').localeCompare(a.aangemaakt || ''));
  const kl = Object.fromEntries(d.klanten.map((k) => [k.id, k]));
  return (
    <section className="sec">
      <h3>Contact over deze auto <span className="aux">{list.length}</span> <button className="btn sm" onClick={() => setForm(true)}>+ Contact</button></h3>
      {!list.length ? <p className="note">Nog geen contactmomenten.</p> : list.map((x) => (
        <div key={x.id} className="doc">
          <span className="note" style={{ minWidth: 80 }}>{fmtD(x.datum)}</span>
          <button className="linkish" onClick={() => openKlant(x.klant_id)}>{kl[x.klant_id]?.naam || 'Klant'}</button>
          <span className="chip">{UITL[x.uitkomst] || x.kanaal || 'Contact'}</span>
          {x.afspraak && <span className="chip live">afspraak {fmtD(x.afspraak)}</span>}
          {x.notitie && <span className="note" style={{ flexBasis: '100%' }}>{x.notitie}</span>}
        </div>
      ))}
      {form && <ContactForm carId={c.id} onClose={() => setForm(false)} />}
    </section>
  );
}
