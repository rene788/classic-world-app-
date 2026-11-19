import { useState } from 'react';
import { useApp, Modal, Field, Sel, DelBtn, Empty, useForm } from '../ui';
import { AANBOD_ST, bestMatch, eur, fmtD, int, num } from '../lib';

export default function Aanbod() {
  const { d, act, openKlant } = useApp();
  const [st, setSt] = useState('open');
  const [form, setForm] = useState(null);
  const list = d.aanbod
    .filter((a) => st === 'alle' || (st === 'open' ? ['nieuw', 'interessant'].includes(a.status) : a.status === st))
    .sort((a, b) => (b.aangemaakt || '').localeCompare(a.aangemaakt || ''));
  const matchesFor = (a) => d.klanten.filter((k) => bestMatch(d.wensenByKlant[k.id] || [], a, a.prijs));
  const safe = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

  return (
    <div>
      <div className="filters">
        <Sel value={st} onChange={setSt} options={[['open', 'Nieuw en interessant'], ...AANBOD_ST, ['alle', 'Alles']]} aria-label="Status" />
        <button className="btn primary" onClick={() => setForm({})}>+ Gevonden auto</button>
        <p className="note" style={{ flex: '1 1 260px' }}>Auto's die jullie te koop zagen. Je ziet meteen welke klanten zoiets zoeken.</p>
      </div>
      {!list.length ? <div className="pane"><Empty title="Niets in deze lijst">Voeg een auto toe die je online of bij een handelaar tegenkwam.</Empty></div>
        : list.map((a) => {
          const ms = matchesFor(a);
          return (
            <div key={a.id} className="wcard">
              <div className="wcard-h">
                <h3>{[a.merk, a.model, a.type].filter(Boolean).join(' ') || 'Auto'}{a.bouwjaar ? `, ${a.bouwjaar}` : ''}</h3>
                <div className="d-actions">
                  {a.prijs ? <span className="chip">{eur(a.prijs)}</span> : null}
                  {a.land && <span className="chip">{a.land}</span>}
                  {safe(a.link) && <a className="btn sm" href={safe(a.link)} target="_blank" rel="noreferrer">Advertentie</a>}
                  <Sel value={a.status} onChange={(v) => act((db) => db.update('aanbod', a.id, { status: v }), null, ['aanbod'])} options={AANBOD_ST} aria-label="Status" />
                  <button className="btn sm" onClick={() => setForm(a)}>Wijzigen</button>
                </div>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {a.notitie && <span style={{ whiteSpace: 'pre-wrap' }}>{a.notitie}</span>}
                <span className="note">{[a.bron, `gevonden ${fmtD(a.aangemaakt)}`].filter(Boolean).join(' · ')}</span>
                {ms.length > 0 && <div>{ms.map((k) => <button key={k.id} className="chip match" style={{ border: 0, cursor: 'pointer', marginRight: 6 }} onClick={() => openKlant(k.id)}>{k.naam} zoekt dit</button>)}</div>}
              </div>
            </div>
          );
        })}
      {form && <AanbodForm item={form.id ? form : null} onClose={() => setForm(null)} />}
    </div>
  );
}

function AanbodForm({ item, onClose }) {
  const { act } = useApp();
  const a = item || {};
  const [f, set] = useForm({ merk: a.merk ?? '', model: a.model ?? '', type: a.type ?? '', bouwjaar: a.bouwjaar ?? '', prijs: a.prijs ?? '', land: a.land ?? '', bron: a.bron ?? '', link: a.link ?? '', notitie: a.notitie ?? '' });
  const save = async () => {
    const row = { merk: f.merk.trim() || null, model: f.model.trim() || null, type: f.type.trim() || null, bouwjaar: int(f.bouwjaar), prijs: num(f.prijs),
      land: f.land.trim() || null, bron: f.bron.trim() || null, link: f.link.trim() || null, notitie: f.notitie.trim() || null };
    if (await act((db) => (item ? db.update('aanbod', item.id, row) : db.insert('aanbod', row)), 'Opgeslagen', ['aanbod'])) onClose();
  };
  const del = async () => { if (await act((db) => db.remove('aanbod', item.id), 'Verwijderd', ['aanbod'])) onClose(); };
  return (
    <Modal title={item ? 'Gevonden auto wijzigen' : 'Gevonden auto toevoegen'} onClose={onClose}
      footer={<>{item && <span style={{ marginRight: 'auto' }}><DelBtn onConfirm={del} /></span>}<button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" onClick={save}>Opslaan</button></>}>
      <div className="grid2">
        <Field label="Merk"><input className="in" value={f.merk} onChange={set('merk')} autoFocus /></Field>
        <Field label="Model"><input className="in" value={f.model} onChange={set('model')} /></Field>
        <Field label="Type"><input className="in" value={f.type} onChange={set('type')} /></Field>
        <Field label="Bouwjaar"><input className="in" inputMode="numeric" value={f.bouwjaar} onChange={set('bouwjaar')} /></Field>
        <Field label="Prijs (€)"><input className="in" inputMode="decimal" value={f.prijs} onChange={set('prijs')} /></Field>
        <Field label="Land"><input className="in" value={f.land} onChange={set('land')} /></Field>
      </div>
      <div className="grid2">
        <Field label="Bron (site of handelaar)"><input className="in" value={f.bron} onChange={set('bron')} /></Field>
        <Field label="Link naar advertentie"><input className="in" type="url" value={f.link} onChange={set('link')} placeholder="https://" /></Field>
      </div>
      <Field label="Notitie"><textarea className="in" value={f.notitie} onChange={set('notitie')} /></Field>
    </Modal>
  );
}
