import { useState } from 'react';
import { useApp, Modal, Field, Sel, DelBtn, Empty, useForm } from '../ui';
import { fmtD, today, norm, numDec, hrs } from '../lib';
import { werkers, Wie } from './Planning';

// Reparaties van klanten: auto's die niet van ons zijn maar wel in de werkplaats komen
export const REP_ST = [['aangemeld', 'Aangemeld'], ['gepland', 'Gepland'], ['bezig', 'Bezig'], ['wacht', 'Wacht op onderdelen'], ['klaar', 'Klaar, klant bellen'], ['opgehaald', 'Opgehaald']];
export const REPL = Object.fromEntries(REP_ST);
export const repOpen = (r) => r.status !== 'opgehaald';
const ST_KLEUR = { aangemeld: '', gepland: '', bezig: 'match', wacht: 'warn', klaar: 'ok', opgehaald: '' };

export default function Reparaties() {
  const { d, act, werker } = useApp();
  const [q, setQ] = useState('');
  const [st, setSt] = useState('open');
  const [form, setForm] = useState(null);
  const s = norm(q);
  const lijst = (d.reparaties || [])
    .filter((r) => st === 'alle' || (st === 'open' ? repOpen(r) : r.status === st))
    .filter((r) => !s || norm([r.nr, r.klant_naam, r.auto, r.kenteken, r.omschrijving].join(' ')).includes(s))
    .sort((a, b) => (a.status === 'opgehaald') - (b.status === 'opgehaald') || (a.klaar_voor || '9999').localeCompare(b.klaar_voor || '9999') || (b.nr || 0) - (a.nr || 0));
  const zet = (r, status) => act((db) => db.update('reparaties', r.id, { status }), `${r.auto}: ${REPL[status].toLowerCase()}`, ['reparaties']);
  const wijs = (r, id) => act((db) => db.update('reparaties', r.id, { toegewezen_aan: id }), null, ['reparaties']);

  return (
    <div>
      <div className="filters">
        <input className="in" style={{ flex: '1 1 200px' }} placeholder="Zoek klant, auto, kenteken, nummer…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoeken" />
        <Sel value={st} onChange={setSt} options={[['open', 'Alles wat nog loopt'], ...REP_ST, ['alle', 'Alle reparaties']]} aria-label="Status" />
        {werker && <button className="btn primary" onClick={() => setForm({})}>+ Reparatie</button>}
      </div>
      {!lijst.length ? <div className="pane"><Empty title="Geen reparaties">Leg hier auto's van klanten vast die voor onderhoud of reparatie binnenkomen, los van de eigen voorraad.</Empty></div> : (
        <div className="tw"><table>
          <thead><tr><th>Nr</th><th>Klant</th><th>Auto</th><th>Wat</th><th>Wie</th><th>Status</th><th>Klaar voor</th><th className="r">Uren</th></tr></thead>
          <tbody>{lijst.map((r) => {
            const laat = repOpen(r) && r.status !== 'klaar' && r.klaar_voor && r.klaar_voor < today();
            return (
              <tr key={r.id} className="click" onClick={() => setForm(r)}>
                <td className="mono">R{r.nr}</td>
                <td>{r.klant_naam || '—'}{r.telefoon && <div className="note mono">{r.telefoon}</div>}</td>
                <td>{r.auto}{r.kenteken && <div className="note mono">{r.kenteken}</div>}</td>
                <td style={{ maxWidth: 280 }}>{r.omschrijving}</td>
                <td onClick={(e) => e.stopPropagation()}><Wie d={d} t={r} onWijzig={werker ? (id) => wijs(r, id) : null} /></td>
                <td onClick={(e) => e.stopPropagation()}>
                  {werker ? <select className={`in sm st-sel ${ST_KLEUR[r.status]}`} value={r.status} onChange={(e) => zet(r, e.target.value)} aria-label="Status">
                    {REP_ST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select> : <span className={`chip ${ST_KLEUR[r.status]}`}>{REPL[r.status]}</span>}
                </td>
                <td>{r.klaar_voor ? <span className={laat ? 'bad' : ''}>{fmtD(r.klaar_voor)}</span> : <span className="note">—</span>}</td>
                <td className="r num">{r.uren_besteed != null || r.uren_geschat != null ? `${hrs(r.uren_besteed || 0)}${r.uren_geschat != null ? ` / ${hrs(r.uren_geschat)}` : ''}` : ''}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      {form && <ReparatieForm rep={form.id ? form : null} onClose={() => setForm(null)} />}
    </div>
  );
}

export function ReparatieForm({ rep, onClose }) {
  const { d, act, geld, werker } = useApp();
  const r = rep || {};
  const [f, set, setF] = useForm({
    klant_id: r.klant_id ?? '', klant_naam: r.klant_naam ?? '', telefoon: r.telefoon ?? '', auto: r.auto ?? '', kenteken: r.kenteken ?? '',
    omschrijving: r.omschrijving ?? '', status: r.status ?? 'aangemeld', toegewezen_aan: r.toegewezen_aan ?? '',
    binnen_op: r.binnen_op ?? today(), klaar_voor: r.klaar_voor ?? '', uren_geschat: r.uren_geschat != null ? String(r.uren_geschat).replace('.', ',') : '',
    uren_besteed: r.uren_besteed != null ? String(r.uren_besteed).replace('.', ',') : '', notitie: r.notitie ?? '',
  });
  const [busy, setBusy] = useState(false);
  const kiesKlant = (id) => {
    const k = d.klanten.find((x) => x.id === id);
    setF((x) => ({ ...x, klant_id: id, ...(k ? { klant_naam: k.naam || x.klant_naam, telefoon: k.telefoon || x.telefoon } : {}) }));
  };
  const goed = f.auto.trim() && f.omschrijving.trim();
  const save = async () => {
    if (!goed) return;
    setBusy(true);
    const row = {
      klant_id: f.klant_id || null, klant_naam: f.klant_naam.trim() || null, telefoon: f.telefoon.trim() || null, auto: f.auto.trim(),
      kenteken: f.kenteken.trim().toUpperCase() || null, omschrijving: f.omschrijving.trim(), status: f.status, toegewezen_aan: f.toegewezen_aan || null,
      binnen_op: f.binnen_op || null, klaar_voor: f.klaar_voor || null, uren_geschat: numDec(f.uren_geschat), uren_besteed: numDec(f.uren_besteed), notitie: f.notitie.trim() || null,
    };
    const ok = await act((db) => (rep ? db.update('reparaties', rep.id, row) : db.insert('reparaties', row)), rep ? 'Reparatie bijgewerkt' : 'Reparatie aangemeld', ['reparaties']);
    setBusy(false);
    if (ok) onClose();
  };
  const del = async () => { if (await act((db) => db.remove('reparaties', r.id), 'Verwijderd', ['reparaties'])) onClose(); };
  const lees = !werker;

  return (
    <Modal title={rep ? `Reparatie R${r.nr}` : 'Reparatie aanmelden'} onClose={onClose}
      footer={lees ? <button className="btn" onClick={onClose}>Sluiten</button> : <>
        {rep && geld && <span style={{ marginRight: 'auto' }}><DelBtn onConfirm={del} /></span>}
        <button className="btn" onClick={onClose}>Annuleren</button>
        <button className="btn primary" disabled={busy || !goed} onClick={save}>{busy ? 'Opslaan…' : 'Opslaan'}</button>
      </>}>
      <fieldset disabled={lees} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {geld && d.klanten.length > 0 && (
          <Field label="Bestaande klant (optioneel)"><Sel value={f.klant_id} onChange={kiesKlant} options={[...d.klanten].sort((a, b) => a.naam.localeCompare(b.naam, 'nl')).map((k) => [k.id, k.naam])} empty="Geen / nieuwe klant" style={{ width: '100%' }} /></Field>
        )}
        <div className="grid2">
          <Field label="Naam klant"><input className="in" value={f.klant_naam} onChange={set('klant_naam')} autoFocus={!rep} /></Field>
          <Field label="Telefoon"><input className="in mono" type="tel" value={f.telefoon} onChange={set('telefoon')} /></Field>
          <Field label="Auto *"><input className="in" value={f.auto} onChange={set('auto')} placeholder="bijv. Porsche 911 SC 1981" /></Field>
          <Field label="Kenteken"><input className="in mono" value={f.kenteken} onChange={set('kenteken')} /></Field>
        </div>
        <Field label="Wat moet er gebeuren? *"><textarea className="in" rows={3} value={f.omschrijving} onChange={set('omschrijving')} placeholder="bijv. grote beurt, remmen rondom, lekkage motor" /></Field>
        <div className="grid2">
          <Field label="Status"><Sel value={f.status} onChange={set('status')} options={REP_ST} /></Field>
          <Field label="Wie pakt het op"><Sel value={f.toegewezen_aan} onChange={set('toegewezen_aan')} options={werkers(d).map((p) => [p.id, p.naam || p.email])} empty="Nog niemand" /></Field>
          <Field label="Binnen op"><input className="in" type="date" value={f.binnen_op} onChange={set('binnen_op')} /></Field>
          <Field label="Klaar voor"><input className="in" type="date" value={f.klaar_voor} onChange={set('klaar_voor')} /></Field>
          <Field label="Uren geschat"><input className="in" inputMode="decimal" value={f.uren_geschat} onChange={set('uren_geschat')} /></Field>
          <Field label="Uren besteed"><input className="in" inputMode="decimal" value={f.uren_besteed} onChange={set('uren_besteed')} /></Field>
        </div>
        <Field label="Notitie voor de werkplaats"><textarea className="in" rows={2} value={f.notitie} onChange={set('notitie')} /></Field>
      </fieldset>
    </Modal>
  );
}
