import { useEffect, useState } from 'react';
import { useApp, Modal, Sel, Plate, Nr, Status, Loc, DelBtn, Field, useUrls, CarFoto, DocLink } from '../ui';
import {
  STATUSES, PART_ST, KOST_SOORT, ORDER_ST, FASES, BESTEMMING, CHECK_DEFAULT, UITL, carName, fmtD, eur, eur2, km, hrs, sum,
  daysSince, num, today, carCost, wishText, shrink, safeName, rid, thumb, opVoorraad, eurVrij,
} from '../lib';
import { UrenForm } from './MijnWerk';
import { BestellingForm } from './Bestellingen';
import { ContactForm } from './Klanten';

export default function AutoDossier({ car, onEdit }) {
  const { d, act, setNav, geld, beheerder, klant } = useApp();
  const c = car;
  const dg = daysSince(c.datum_binnen);

  const [annuleer, setAnnuleer] = useState(false);
  const setStatus = (status) => (status === 'geannuleerd' ? setAnnuleer(true) : act((db) => db.update('autos', c.id, { status, ...(c.status === 'geannuleerd' ? { geannuleerd_op: null, annuleer_reden: null } : {}), ...(status === 'verkocht' && !c.verkoopdatum ? { verkoopdatum: today() } : {}), ...(c.status === 'onderweg' && ['binnen', 'werkplaats', 'klaar'].includes(status) ? { datum_binnen: today() } : {}) }), 'Status bijgewerkt', ['autos']));
  const del = async () => { if (await act((db) => db.remove('autos', c.id), 'Auto verwijderd', ['autos'])) setNav((n) => ({ ...n, carId: null })); };

  return (
    <div className="detail">
      <div>
        <button className="btn ghost sm back" onClick={() => setNav((n) => ({ ...n, carId: null }))}>← Terug naar lijst</button>
        <div className="d-head">
          <ProfielFoto c={c} />
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <h2 className="d-title">{carName(c)}{c.bouwjaar ? `, ${c.bouwjaar}` : ''}</h2>
            <div className="d-sub"><Nr c={c} lg /><Plate c={c} lg /><Status s={c.status} /><Loc c={c} /></div>
            <DocLink c={c} edit={geld} />
          </div>
          <div className="d-actions">
            {geld && <Sel value={c.status} onChange={setStatus} options={STATUSES} aria-label="Status wijzigen" />}
            {geld && <button className="btn" onClick={onEdit}>Wijzigen</button>}
            {beheerder && <DelBtn onConfirm={del} label="Verwijderen" />}
          </div>
        </div>
      </div>

      <dl className="facts">
        <Fact k="Chassisnummer" v={c.chassisnr} mono />
        <Fact k="Kilometerstand" v={km(c.km)} />
        <Fact k="Kleur" v={c.kleur} />
        {c.status === 'onderweg'
          ? <Fact k="Onderweg" v={c.locatie_info || 'nog niet binnen'} />
          : !klant && <Fact k="Binnen sinds" v={c.datum_binnen ? `${fmtD(c.datum_binnen)}${opVoorraad(c) && dg != null ? ` (${dg} d)` : ''}` : ''} />}
        {c.verkoopdatum && <Fact k="Verkocht op" v={fmtD(c.verkoopdatum)} />}
        {c.status === 'geannuleerd' && <Fact k="Aankoop geannuleerd" v={`${c.geannuleerd_op ? fmtD(c.geannuleerd_op) : 'datum onbekend'}${c.annuleer_reden ? ` · ${c.annuleer_reden}` : ''}`} />}
        {geld && <Fact k="Vraagprijs" v={eur(d.prijsOf(c))} />}
        {klant?.prijs && <Fact k="Vraagprijs" v={d.prijsOf(c) != null ? eurVrij(d.prijsOf(c)) : 'Op aanvraag'} />}
        {c.bestemming && <Fact k="Bestemming" v={Object.fromEntries(BESTEMMING)[c.bestemming]} />}
      </dl>
      {c.omschrijving && !klant && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.omschrijving}</p>}
      {c.status === 'geannuleerd' && <div className="banner warn" style={{ margin: 0 }}>Deze aankoop is geannuleerd. De auto telt niet meer mee in de voorraad, de voorraadwaarde of de matches. De bedragen staan op het overzicht bij "Geannuleerde aankopen".</div>}
      {annuleer && <AnnuleerForm c={c} onClose={() => setAnnuleer(false)} />}

      {geld && <MatchesSec c={c} />}
      <Taken c={c} />
      <Onderdelen c={c} />
      <UrenSec c={c} />
      <Media c={c} />
      {geld && <Financien c={c} />}
      {geld && <Afleverlijst c={c} />}
      {geld && <Contacten c={c} />}
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

function ProfielFoto({ c }) {
  const { act, geld } = useApp();
  const urls = useUrls([c.foto]);
  const [busy, setBusy] = useState(false);
  const kies = async (file) => {
    if (!file) return;
    setBusy(true);
    const oud = c.foto;
    const ok = await act(async (db) => {
      const klein = await thumb(file);
      const pad = `${c.id}/profiel/${rid().slice(0, 8)}.jpg`;
      await db.upload(pad, klein);
      await db.update('autos', c.id, { foto: pad });
    }, 'Profielfoto opgeslagen', ['autos']);
    if (ok && oud) act(async (db) => { try { await db.removeFile(oud); } catch { /* mag blijven staan */ } });
    setBusy(false);
  };
  const weg = () => act(async (db) => { await db.update('autos', c.id, { foto: null }); try { await db.removeFile(c.foto); } catch { /* mag blijven staan */ } }, 'Profielfoto verwijderd', ['autos']);
  return (
    <div className="pfoto">
      <CarFoto c={c} url={urls[c.foto]} lg />
      {geld && (
        <div className="pfoto-k">
          <label className="btn sm filebtn">{busy ? 'Bezig…' : c.foto ? 'Andere foto' : '+ Profielfoto'}
            <input type="file" accept="image/*" disabled={busy} onChange={(e) => { kies(e.target.files[0]); e.target.value = ''; }} />
          </label>
          {c.foto && !busy && <DelBtn x label="Profielfoto verwijderen" onConfirm={weg} />}
        </div>
      )}
    </div>
  );
}

const Fact = ({ k, v, mono }) => <div className="fact"><dt>{k}</dt><dd className={mono ? 'mono' : undefined}>{v || '—'}</dd></div>;

function MatchesSec({ c }) {
  const { d, act, openKlant } = useApp();
  const ms = d.matchesForCar(c);
  if (!ms.length || !opVoorraad(c)) return null;
  const inform = (k) => act((db) => db.insert('contactmomenten', { klant_id: k.id, auto_id: c.id, uitkomst: 'geinformeerd', datum: today() }), 'Gemarkeerd als geïnformeerd', ['contactmomenten']);
  return (
    <section className="sec">
      <h3>Klanten die dit zoeken <span className="aux">{ms.filter((m) => !m.informed).length} nog te informeren</span></h3>
      <div className="matchbox">
        {ms.map((m) => (
          <div key={m.klant.id} className="m-item">
            <div className="m-who">
              <button className="linkish" onClick={() => openKlant(m.klant.id)}>{m.klant.naam}</button>
              <div className="m-wish">Zoekt: {wishText(m.wish)}{m.over ? ' · vraagprijs iets boven budget' : ''}</div>
              <div className="m-wish">{[m.klant.telefoon, m.klant.email].filter(Boolean).join(' · ')}</div>
            </div>
            {m.informed ? <span className="chip ok">Geïnformeerd</span> : <button className="btn sm" onClick={() => inform(m.klant)}>Geïnformeerd</button>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Taken({ c }) {
  const { d, act, werker, geld, uid } = useApp();
  const [t, setT] = useState('');
  const [m, setM] = useState('');
  const list = d.taken.filter((x) => x.auto_id === c.id).sort((a, b) => (a.klaar - b.klaar) || (a.volgorde - b.volgorde) || (a.aangemaakt || '').localeCompare(b.aangemaakt || ''));
  const done = list.filter((x) => x.klaar).length;
  const add = async (e) => {
    e.preventDefault();
    if (!t.trim()) return;
    if (await act((db) => db.insert('taken', { auto_id: c.id, tekst: t.trim(), monteur: m.trim() || null, volgorde: list.length }), null, ['taken'])) { setT(''); }
  };
  const toggle = (x) => act((db) => db.update('taken', x.id, { klaar: !x.klaar, klaar_door: !x.klaar ? uid : null, klaar_op: !x.klaar ? new Date().toISOString() : null }), null, ['taken']);
  return (
    <section className="sec">
      <h3>Takenlijst <span className="aux">{done} van {list.length} klaar</span>{list.length > 0 && <span className="bar"><i style={{ width: `${(done / list.length) * 100}%` }} /></span>}</h3>
      {werker && (
        <form className="add" onSubmit={add}>
          <input className="in" value={t} onChange={(e) => setT(e.target.value)} placeholder="Nieuwe taak, bijv. remmen nalopen" aria-label="Nieuwe taak" />
          <input className="in" style={{ flex: '0 1 150px' }} value={m} onChange={(e) => setM(e.target.value)} placeholder="Monteur (optioneel)" aria-label="Monteur" />
          <button className="btn">Toevoegen</button>
        </form>
      )}
      {!list.length ? <p className="note">Nog geen taken.</p> : list.map((x) => (
        <div key={x.id} className={`todo${x.klaar ? ' done' : ''}`}>
          <input type="checkbox" checked={!!x.klaar} disabled={!werker} onChange={() => toggle(x)} aria-label={`Taak ${x.tekst} afvinken`} />
          <span className="t">{x.tekst}{x.uitleg && <span className="note"> — {x.uitleg}</span>}</span>
          {x.monteur && <span className="chip">{x.monteur}</span>}
          {x.klaar && x.klaar_door && <span className="note">✓ {d.names[x.klaar_door] || ''}{x.klaar_op ? ` · ${fmtD(x.klaar_op)}` : ''}</span>}
          {geld && <DelBtn x onConfirm={() => act((db) => db.remove('taken', x.id), null, ['taken'])} />}
        </div>
      ))}
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

  const saveFin = (patch) => act((db) => db.upsert('auto_financien', { auto_id: c.id, inkoopprijs: f.inkoopprijs ?? null, vraagprijs: f.vraagprijs ?? null, regeling: f.regeling || 'marge', verkoopprijs: f.verkoopprijs ?? null, ...patch }), 'Opgeslagen', ['auto_financien']);
  const kosten = d.kosten.filter((x) => x.auto_id === c.id).sort((a, b) => b.datum.localeCompare(a.datum));
  const ords = d.bestellingen.filter((x) => x.auto_id === c.id).sort((a, b) => b.datum.localeCompare(a.datum));

  return (
    <section className="sec">
      <h3>Kosten en marge <span className="aux">alleen zichtbaar voor verkoop en beheerder</span></h3>
      <div className="grid2" style={{ marginBottom: 12 }}>
        <Field label="Verkoopprijs (bij verkoop)">
          <input className="in" inputMode="decimal" value={vk} onChange={(e) => setVk(e.target.value)} onBlur={() => { if (num(vk) !== (f.verkoopprijs ?? null)) saveFin({ verkoopprijs: num(vk) }); }} />
        </Field>
        <Field label="Btw-regeling">
          <Sel value={f.regeling || 'marge'} onChange={(v) => saveFin({ regeling: v })} options={[['marge', 'Margeregeling'], ['btw', 'Btw-auto (21% over verkoopprijs)']]} />
        </Field>
      </div>
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
      {!k.tarief && <p className="hint" style={{ marginTop: 6 }}>Het interne uurtarief staat op € 0. De beheerder stelt het in bij Beheer.</p>}
      {(k.klantUren > 0 || k.klantFacturen > 0) && (
        <div className="ledger" style={{ marginTop: 12 }}>
          <Row l={`Voor de klant: ${hrs(k.klantUren)} uur × ${eur2(k.tariefKlant)}`} v={eur2(k.klantArbeid)} />
          <Row l="Voor de klant: bestellingen" v={eur2(k.klantFacturen)} />
          <Row l="Door te belasten aan klant" v={eur2(k.klantArbeid + k.klantFacturen)} cls="total" />
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
