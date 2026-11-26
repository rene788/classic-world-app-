import { useState } from 'react';
import { useApp, Modal, Field, Sel, Empty } from '../ui';
import { carLabel, fmtD, today, opVoorraad } from '../lib';

// ---------- gedeelde bouwstenen voor taken met een persoon ----------

// Mensen aan wie je werk kunt geven: iedereen met een inlog behalve meekijkers
export const werkers = (d) => d.profielen
  .filter((p) => ['beheerder', 'verkoop', 'monteur'].includes(p.rol))
  .sort((a, b) => (a.rol === 'monteur' ? 0 : 1) - (b.rol === 'monteur' ? 0 : 1) || (a.naam || a.email || '').localeCompare(b.naam || b.email || ''));
export const naamVan = (d, id) => (id && (d.names[id] || 'Onbekend')) || null;
const initialen = (n) => String(n || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');

// Taak is te laat als de datum voorbij is en hij nog open staat
export const teLaat = (t) => !t.klaar && t.deadline && t.deadline < today();

export function Wie({ d, t, onWijzig }) {
  const naam = naamVan(d, t.toegewezen_aan) || t.monteur || null;
  if (!onWijzig) return naam ? <span className="wie" title={naam}><i>{initialen(naam)}</i>{naam}</span> : <span className="wie leeg">Nog niemand</span>;
  return (
    <label className={`wie kies${naam ? '' : ' leeg'}`} title="Voor wie?">
      <i>{naam ? initialen(naam) : '+'}</i>
      <select value={t.toegewezen_aan || ''} onChange={(e) => onWijzig(e.target.value || null)} aria-label={`Taak ${t.tekst} toewijzen`}>
        <option value="">{t.monteur && !t.toegewezen_aan ? `${t.monteur} (oud)` : 'Nog niemand'}</option>
        {werkers(d).map((p) => <option key={p.id} value={p.id}>{p.naam || p.email}</option>)}
      </select>
    </label>
  );
}

export function Deadline({ t }) {
  if (!t.deadline || t.klaar) return null;
  const n = Math.round((new Date(`${t.deadline}T12:00:00`) - new Date(`${today()}T12:00:00`)) / 864e5); // dagen tot de datum
  return <span className={`chip${teLaat(t) ? ' bad' : n <= 2 ? ' warn' : ''}`}>{teLaat(t) ? `te laat · ${fmtD(t.deadline)}` : n === 0 ? 'vandaag klaar' : n === 1 ? 'morgen klaar' : `klaar voor ${fmtD(t.deadline)}`}</span>;
}

// Nieuw werk toevoegen, met of zonder auto
export function TaakForm({ preset = {}, onClose }) {
  const { d, act } = useApp();
  const autos = d.autos.filter((c) => opVoorraad(c) || c.id === preset.auto_id).sort((a, b) => String(b.voorraadnr || '').localeCompare(String(a.voorraadnr || ''), 'nl', { numeric: true }));
  const [tekst, setTekst] = useState('');
  const [uitleg, setUitleg] = useState('');
  const [auto, setAuto] = useState(preset.auto_id || '');
  const [wie, setWie] = useState(preset.toegewezen_aan || '');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!tekst.trim()) return;
    setBusy(true);
    const volgorde = d.taken.filter((x) => (x.auto_id || null) === (auto || null)).length;
    const ok = await act((db) => db.insert('taken', { auto_id: auto || null, tekst: tekst.trim(), uitleg: uitleg.trim() || null, toegewezen_aan: wie || null, deadline: deadline || null, volgorde }), 'Werk toegevoegd', ['taken']);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal title="Werk toevoegen" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" disabled={!tekst.trim() || busy} onClick={save}>Toevoegen</button></>}>
      <Field label="Wat moet er gebeuren?"><input className="in" autoFocus value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="bijv. remmen nalopen, onderdelen ophalen, werkplaats opruimen" /></Field>
      <Field label="Toelichting (optioneel)"><input className="in" value={uitleg} onChange={(e) => setUitleg(e.target.value)} /></Field>
      <Field label="Auto">
        <select className="in" value={auto} onChange={(e) => setAuto(e.target.value)}>
          <option value="">Algemeen werk (geen auto)</option>
          {autos.map((c) => <option key={c.id} value={c.id}>{carLabel(c)}</option>)}
        </select>
      </Field>
      <div className="grid2">
        <Field label="Voor wie"><Sel value={wie} onChange={setWie} empty="Nog niemand" options={werkers(d).map((p) => [p.id, p.naam || p.email])} /></Field>
        <Field label="Klaar voor (optioneel)"><input className="in" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------- tabblad Planning: werk per persoon ----------

export default function Planning() {
  const { d, act, werker, uid, openCar } = useApp();
  const [form, setForm] = useState(null);
  const [afgerond, setAfgerond] = useState(false);
  const grens = new Date(Date.now() - 7 * 864e5).toISOString();
  const taken = d.taken
    .filter((t) => !t.klaar || (afgerond && (t.klaar_op || '') >= grens))
    .filter((t) => !t.auto_id || (d.autoById[t.auto_id] && (opVoorraad(d.autoById[t.auto_id]) || t.klaar)))
    .sort((a, b) => (a.klaar - b.klaar) || (a.deadline || '9999').localeCompare(b.deadline || '9999') || (a.aangemaakt || '').localeCompare(b.aangemaakt || ''));
  const mensen = werkers(d);
  const kol = [...mensen.map((p) => ({ id: p.id, naam: p.naam || p.email, rol: p.rol, taken: taken.filter((t) => t.toegewezen_aan === p.id) })),
    { id: '', naam: 'Nog niemand', taken: taken.filter((t) => !t.toegewezen_aan || !mensen.some((p) => p.id === t.toegewezen_aan)) }];
  const toggle = (t) => act((db) => db.update('taken', t.id, { klaar: !t.klaar, klaar_door: !t.klaar ? uid : null, klaar_op: !t.klaar ? new Date().toISOString() : null }), t.klaar ? null : 'Taak afgevinkt', ['taken']);
  const wijs = (t, id) => act((db) => db.update('taken', t.id, { toegewezen_aan: id }), id ? `Toegewezen aan ${naamVan(d, id)}` : 'Toewijzing weggehaald', ['taken']);
  const open = taken.filter((t) => !t.klaar).length;
  const laat = taken.filter(teLaat).length;

  return (
    <div>
      <div className="filters">
        <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 18, margin: 0 }}>Werk per persoon</h2>
        <span className="note">{open} open{laat ? ` · ${laat} te laat` : ''}</span>
        <label className="chk" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={afgerond} onChange={(e) => setAfgerond(e.target.checked)} /> Ook afgerond (7 dagen)</label>
        {werker && <button className="btn primary" onClick={() => setForm({})}>+ Werk toevoegen</button>}
      </div>
      {!mensen.length && <p className="hint">Er zijn nog geen medewerkers met een inlog. Nodig ze uit bij Beheer; daarna kun je werk aan ze geven.</p>}
      <div className="plan">
        {kol.map((k) => (
          <section key={k.id || 'niemand'} className={`plan-k${k.id === uid ? ' ik' : ''}${k.id ? '' : ' niemand'}`}>
            <h3>{k.naam}{k.id === uid ? ' (jij)' : ''} <span className="count num">{k.taken.filter((t) => !t.klaar).length}</span></h3>
            {!k.taken.length ? <p className="note">Geen werk.</p> : k.taken.map((t) => {
              const c = t.auto_id && d.autoById[t.auto_id];
              return (
                <div key={t.id} className={`pk${t.klaar ? ' done' : ''}${teLaat(t) ? ' laat' : ''}`}>
                  <input type="checkbox" checked={!!t.klaar} disabled={!werker} onChange={() => toggle(t)} aria-label={`Taak ${t.tekst} afvinken`} />
                  <div className="pk-b">
                    <div className="pk-t">{t.tekst}</div>
                    {t.uitleg && <div className="note">{t.uitleg}</div>}
                    <div className="pk-m">
                      {c ? <button className="linkish" onClick={() => openCar(c.id)}>{carLabel(c)}</button> : <span className="chip">Algemeen werk</span>}
                      <Deadline t={t} />
                      {werker && !t.klaar && <Wie d={d} t={t} onWijzig={(id) => wijs(t, id)} />}
                    </div>
                  </div>
                </div>
              );
            })}
            {werker && <button className="btn ghost sm pk-add" onClick={() => setForm({ toegewezen_aan: k.id })}>+ Werk{k.id ? ` voor ${k.naam.split(' ')[0]}` : ''}</button>}
          </section>
        ))}
      </div>
      {!taken.length && <div className="pane"><Empty title="Geen open werk">Voeg werk toe met de knop rechtsboven.</Empty></div>}
      {form && <TaakForm preset={form} onClose={() => setForm(null)} />}
    </div>
  );
}
