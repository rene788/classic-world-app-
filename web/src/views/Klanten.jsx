import { useState } from 'react';
import { useApp, Modal, Field, Sel, DelBtn, Empty, Nr, Plate, Status, useForm } from '../ui';
import { UITKOMST, UITL, KANAAL, carLabel, carName, eur, fmtD, norm, wishText, bestMatch, int, num, today, opVoorraad } from '../lib';

export default function Klanten() {
  const { d, nav, setNav } = useApp();
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const s = norm(q);
  const list = d.klanten
    .filter((k) => !s || norm([k.naam, k.telefoon, k.email, k.plaats, k.land, ...(d.wensenByKlant[k.id] || []).map(wishText)].join(' ')).includes(s))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  const k = nav.klantId && d.klanten.find((x) => x.id === nav.klantId);
  const actieveMatches = (kl) => d.autos.filter((c) => opVoorraad(c) && bestMatch(d.wensenByKlant[kl.id] || [], c, d.prijsOf(c))).length;

  return (
    <div className={`split${k ? ' has-detail' : ''}`}>
      <section className="pane list-pane" aria-label="Klanten">
        <div className="pane-h">
          <input className="in search" placeholder="Zoek klant of zoekwens…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoek klant" />
          <button className="btn primary" onClick={() => setForm({})}>+ Klant</button>
        </div>
        <div className="list">
          {!list.length ? <Empty title={d.klanten.length ? 'Niets gevonden' : 'Nog geen klanten'}>{d.klanten.length ? 'Pas je zoekterm aan.' : 'Voeg klanten toe met wat ze zoeken. Komt zo\'n auto binnen, dan zie je dat meteen bij Matches.'}</Empty>
            : list.map((x) => {
              const w = d.wensenByKlant[x.id] || [];
              const m = actieveMatches(x);
              return (
                <button key={x.id} className={`row${k && k.id === x.id ? ' sel' : ''}`} onClick={() => setNav((n) => ({ ...n, klantId: x.id }))}>
                  <span className="row-t">{x.naam}</span>
                  {m > 0 ? <span className="chip match">{m} match{m > 1 ? 'es' : ''}</span> : <span />}
                  <span className="row-m">{w.length ? w.map((y) => <span key={y.id} className="chip">{wishText(y)}</span>) : <span>Geen zoekwens</span>}{x.plaats && <span>{x.plaats}</span>}</span>
                </button>
              );
            })}
        </div>
      </section>
      <section className="pane detail-pane">
        {k ? <KlantDossier k={k} onEdit={() => setForm(k)} /> : <Empty title="Kies een klant">Klik links op een klant voor contactgegevens, zoekwensen en passende auto's.</Empty>}
      </section>
      {form && <KlantForm klant={form.id ? form : null} onClose={() => setForm(null)} />}
    </div>
  );
}

function KlantDossier({ k, onEdit }) {
  const { d, act, setNav, openCar, beheerder } = useApp();
  const [contact, setContact] = useState(false);
  const wensen = d.wensenByKlant[k.id] || [];
  const informed = new Set(d.contactmomenten.filter((x) => x.klant_id === k.id && x.auto_id).map((x) => x.auto_id));
  const matches = d.autos.filter(opVoorraad).map((c) => ({ c, m: bestMatch(wensen, c, d.prijsOf(c)) })).filter((x) => x.m);
  const contacten = d.contactmomenten.filter((x) => x.klant_id === k.id).sort((a, b) => b.datum.localeCompare(a.datum) || (b.aangemaakt || '').localeCompare(a.aangemaakt || ''));
  const del = async () => { if (await act((db) => db.remove('klanten', k.id), 'Klant verwijderd', ['klanten', 'zoekwensen', 'contactmomenten'])) setNav((n) => ({ ...n, klantId: null })); };
  const inform = (c) => act((db) => db.insert('contactmomenten', { klant_id: k.id, auto_id: c.id, uitkomst: 'geinformeerd', datum: today() }), 'Gemarkeerd als geïnformeerd', ['contactmomenten']);

  return (
    <div className="detail">
      <div>
        <button className="btn ghost sm back" onClick={() => setNav((n) => ({ ...n, klantId: null }))}>← Terug naar lijst</button>
        <div className="d-head">
          <div>
            <h2 className="d-title">{k.naam}</h2>
            <div className="d-sub">
              {k.telefoon && <a href={`tel:${k.telefoon.replace(/\s/g, '')}`}>{k.telefoon}</a>}
              {k.email && <a href={`mailto:${k.email}`}>{k.email}</a>}
              {(k.plaats || k.land) && <span>{[k.plaats, k.land].filter(Boolean).join(', ')}</span>}
            </div>
          </div>
          <div className="d-actions">
            <button className="btn" onClick={() => setContact(true)}>+ Contact</button>
            <button className="btn" onClick={onEdit}>Wijzigen</button>
            {beheerder && <DelBtn onConfirm={del} />}
          </div>
        </div>
      </div>
      {k.notitie && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{k.notitie}</p>}

      <section className="sec">
        <h3>Zoekwensen</h3>
        {wensen.map((w) => (
          <div key={w.id} className="todo"><span className="t">{wishText(w)}{w.notitie && <span className="note"> — {w.notitie}</span>}</span>
            <DelBtn x onConfirm={() => act((db) => db.remove('zoekwensen', w.id), null, ['zoekwensen'])} /></div>
        ))}
        <WensForm klantId={k.id} />
      </section>

      <section className="sec">
        <h3>Passende auto's op voorraad <span className="aux">{matches.length}</span></h3>
        {!matches.length ? <p className="note">Nu niets op voorraad dat past.</p> : (
          <div className="matchbox">{matches.map(({ c, m }) => (
            <div key={c.id} className="m-item">
              <div className="m-who">
                <button className="linkish" onClick={() => openCar(c.id)}>{carName(c)}{c.bouwjaar ? `, ${c.bouwjaar}` : ''}</button>
                <div className="m-wish"><Nr c={c} /> <Status s={c.status} c={c} /> {eur(d.prijsOf(c))}{m.over ? ' · iets boven budget' : ''}</div>
              </div>
              {informed.has(c.id) ? <span className="chip ok">Geïnformeerd</span> : <button className="btn sm" onClick={() => inform(c)}>Geïnformeerd</button>}
            </div>
          ))}</div>
        )}
      </section>

      <section className="sec">
        <h3>Contactmomenten <span className="aux">{contacten.length}</span></h3>
        {!contacten.length ? <p className="note">Nog geen contact vastgelegd.</p> : contacten.map((x) => {
          const c = d.autoById[x.auto_id];
          return (
            <div key={x.id} className="doc" style={{ flexWrap: 'wrap' }}>
              <span className="note" style={{ minWidth: 80 }}>{fmtD(x.datum)}</span>
              <span className="chip">{UITL[x.uitkomst] || 'Contact'}</span>
              {x.kanaal && <span className="note">{x.kanaal}</span>}
              {c && <button className="linkish" onClick={() => openCar(c.id)}>{carLabel(c)}</button>}
              {x.afspraak && <span className="chip live">afspraak {fmtD(x.afspraak)}</span>}
              <span className="note">door {d.names[x.door] || '—'}</span>
              <DelBtn x onConfirm={() => act((db) => db.remove('contactmomenten', x.id), null, ['contactmomenten'])} />
              {x.notitie && <span style={{ flexBasis: '100%', whiteSpace: 'pre-wrap' }}>{x.notitie}</span>}
            </div>
          );
        })}
      </section>
      {contact && <ContactForm klantId={k.id} onClose={() => setContact(false)} />}
    </div>
  );
}

function WensForm({ klantId }) {
  const { act } = useApp();
  const empty = { merk: '', model: '', type: '', jaar_van: '', jaar_tot: '', max_prijs: '' };
  const [f, set, setF] = useForm(empty);
  const add = async (e) => {
    e.preventDefault();
    if (!f.merk.trim() && !f.model.trim() && !f.type.trim()) return;
    const ok = await act((db) => db.insert('zoekwensen', { klant_id: klantId, merk: f.merk.trim() || null, model: f.model.trim() || null, type: f.type.trim() || null,
      jaar_van: int(f.jaar_van), jaar_tot: int(f.jaar_tot), max_prijs: num(f.max_prijs) }), 'Zoekwens toegevoegd', ['zoekwensen']);
    if (ok) setF(empty);
  };
  return (
    <form className="wish" style={{ marginTop: 8 }} onSubmit={add}>
      <div className="grid2">
        <Field label="Merk"><input className="in" value={f.merk} onChange={set('merk')} placeholder="bijv. Porsche" /></Field>
        <Field label="Model"><input className="in" value={f.model} onChange={set('model')} placeholder="bijv. 911" /></Field>
        <Field label="Type"><input className="in" value={f.type} onChange={set('type')} placeholder="bijv. 993 Cabrio" /></Field>
      </div>
      <div className="grid2">
        <Field label="Bouwjaar vanaf"><input className="in" inputMode="numeric" value={f.jaar_van} onChange={set('jaar_van')} /></Field>
        <Field label="Bouwjaar tot en met"><input className="in" inputMode="numeric" value={f.jaar_tot} onChange={set('jaar_tot')} /></Field>
        <Field label="Maximale prijs (€)"><input className="in" inputMode="decimal" value={f.max_prijs} onChange={set('max_prijs')} /></Field>
      </div>
      <div><button className="btn">+ Zoekwens toevoegen</button></div>
      <p className="hint">Woorden moeten allemaal in merk, model of type van de auto voorkomen. Een auto tot 15% boven de maximale prijs telt nog mee.</p>
    </form>
  );
}

function KlantForm({ klant, onClose }) {
  const { act, setNav } = useApp();
  const [f, set] = useForm({ naam: klant?.naam ?? '', telefoon: klant?.telefoon ?? '', email: klant?.email ?? '', plaats: klant?.plaats ?? '', land: klant?.land ?? '', notitie: klant?.notitie ?? '' });
  const save = async () => {
    if (!f.naam.trim()) return;
    const row = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]));
    const res = await act((db) => (klant ? db.update('klanten', klant.id, row) : db.insert('klanten', row)), klant ? 'Klant bijgewerkt' : 'Klant toegevoegd', ['klanten']);
    if (res) { if (!klant) setNav((n) => ({ ...n, klantId: res.id })); onClose(); }
  };
  return (
    <Modal title={klant ? 'Klant wijzigen' : 'Klant toevoegen'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" disabled={!f.naam.trim()} onClick={save}>Opslaan</button></>}>
      <Field label="Naam"><input className="in" value={f.naam} onChange={set('naam')} autoFocus /></Field>
      <div className="grid2">
        <Field label="Telefoon"><input className="in" type="tel" value={f.telefoon} onChange={set('telefoon')} /></Field>
        <Field label="E-mail"><input className="in" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Plaats"><input className="in" value={f.plaats} onChange={set('plaats')} /></Field>
        <Field label="Land"><input className="in" value={f.land} onChange={set('land')} /></Field>
      </div>
      <Field label="Notitie"><textarea className="in" value={f.notitie} onChange={set('notitie')} /></Field>
      {!klant && <p className="hint">Na opslaan voeg je in het klantdossier toe wat de klant zoekt.</p>}
    </Modal>
  );
}

export function ContactForm({ klantId, carId, onClose }) {
  const { d, act } = useApp();
  const [f, set] = useForm({ klant_id: klantId ?? '', auto_id: carId ?? '', datum: today(), kanaal: 'Telefoon', uitkomst: 'geinformeerd', afspraak: '', notitie: '' });
  const save = async () => {
    if (!f.klant_id) return;
    const ok = await act((db) => db.insert('contactmomenten', { klant_id: f.klant_id, auto_id: f.auto_id || null, datum: f.datum, kanaal: f.kanaal, uitkomst: f.uitkomst || null,
      afspraak: f.afspraak || null, notitie: f.notitie.trim() || null }), 'Contact vastgelegd', ['contactmomenten']);
    if (ok) onClose();
  };
  return (
    <Modal title="Contactmoment vastleggen" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" disabled={!f.klant_id} onClick={save}>Opslaan</button></>}>
      {!klantId && <Field label="Klant"><Sel value={f.klant_id} onChange={set('klant_id')} options={[...d.klanten].sort((a, b) => a.naam.localeCompare(b.naam, 'nl')).map((k) => [k.id, k.naam])} empty="Kies een klant" /></Field>}
      {!carId && <Field label="Over auto (optioneel)"><Sel value={f.auto_id} onChange={set('auto_id')} options={d.autos.map((c) => [c.id, carLabel(c)])} empty="Geen specifieke auto" /></Field>}
      <div className="grid2">
        <Field label="Datum"><input className="in" type="date" value={f.datum} onChange={set('datum')} /></Field>
        <Field label="Hoe"><Sel value={f.kanaal} onChange={set('kanaal')} options={KANAAL.map((k) => [k, k])} /></Field>
        <Field label="Uitkomst"><Sel value={f.uitkomst} onChange={set('uitkomst')} options={UITKOMST} /></Field>
        <Field label="Afspraak op (optioneel)"><input className="in" type="date" value={f.afspraak} onChange={set('afspraak')} /></Field>
      </div>
      <Field label="Notitie"><textarea className="in" value={f.notitie} onChange={set('notitie')} /></Field>
    </Modal>
  );
}

export function Matches() {
  const { d, act, openCar, openKlant } = useApp();
  const [alle, setAlle] = useState(false);
  const rows = d.autos.filter(opVoorraad)
    .map((c) => ({ c, ms: d.matchesForCar(c).filter((m) => alle || !m.informed) }))
    .filter((x) => x.ms.length);
  const inform = (k, c) => act((db) => db.insert('contactmomenten', { klant_id: k.id, auto_id: c.id, uitkomst: 'geinformeerd', datum: today() }), `${k.naam} gemarkeerd als geïnformeerd`, ['contactmomenten']);
  return (
    <div>
      <div className="filters">
        <p className="note" style={{ flex: '1 1 300px' }}>Klanten met een zoekwens die past bij een auto op voorraad. Markeer ze als geïnformeerd zodra je contact hebt gehad.</p>
        <label className="chk"><input type="checkbox" checked={alle} onChange={(e) => setAlle(e.target.checked)} /> Toon ook geïnformeerd</label>
      </div>
      {!rows.length ? <div className="pane"><Empty title="Geen open matches">{d.klanten.length ? 'Iedereen met een passende zoekwens is geïnformeerd.' : 'Voeg klanten met zoekwensen toe bij Klanten.'}</Empty></div>
        : rows.map(({ c, ms }) => (
          <div key={c.id} className="wcard">
            <div className="wcard-h">
              <h3><button className="linkish" style={{ fontSize: 'inherit' }} onClick={() => openCar(c.id)}>{carName(c)}{c.bouwjaar ? `, ${c.bouwjaar}` : ''}</button></h3>
              <div className="d-actions"><Nr c={c} /><Plate c={c} /><Status s={c.status} c={c} />{d.prijsOf(c) ? <span className="chip">{eur(d.prijsOf(c))}</span> : null}</div>
            </div>
            <div style={{ padding: '2px 14px' }}>{ms.map((m) => (
              <div key={m.klant.id} className="m-item" style={{ borderBottomColor: 'var(--line)' }}>
                <div className="m-who">
                  <button className="linkish" onClick={() => openKlant(m.klant.id)}>{m.klant.naam}</button>
                  <div className="m-wish">Zoekt: {wishText(m.wish)}{m.over ? ' · vraagprijs iets boven budget' : ''}</div>
                  <div className="m-wish">{[m.klant.telefoon, m.klant.email].filter(Boolean).join(' · ')}</div>
                </div>
                {m.informed ? <span className="chip ok">Geïnformeerd</span> : <button className="btn sm" onClick={() => inform(m.klant, c)}>Geïnformeerd</button>}
              </div>
            ))}</div>
          </div>
        ))}
    </div>
  );
}
