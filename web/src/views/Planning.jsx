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

// Werk toevoegen: kies een auto, vink bestaande taken aan en/of voeg een nieuwe taak toe
export function TaakForm({ preset = {}, onClose }) {
  const { d, act, geld } = useApp();
  const autos = d.autos.filter((c) => opVoorraad(c) || c.id === preset.auto_id).sort((a, b) => String(b.voorraadnr || '').localeCompare(String(a.voorraadnr || ''), 'nl', { numeric: true }));
  const [tekst, setTekst] = useState('');
  const [uitleg, setUitleg] = useState('');
  const [auto, setAuto] = useState(preset.auto_id || '');
  const [wie, setWie] = useState(preset.toegewezen_aan || '');
  const [deadline, setDeadline] = useState('');
  const [gekozen, setGekozen] = useState([]);
  const [hele, setHele] = useState(false);
  const [busy, setBusy] = useState(false);
  const bestaand = auto ? d.taken.filter((t) => t.auto_id === auto && !t.klaar).sort((a, b) => a.volgorde - b.volgorde) : [];
  const kiesAuto = (v) => { setAuto(v); setGekozen([]); setHele(false); };
  const heleAan = (v) => { setHele(v); setGekozen(v ? bestaand.map((t) => t.id) : []); };
  const huidig = auto && d.autoById[auto]?.toegewezen_aan;
  const wissel = (id) => setGekozen((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  const klaarOm = tekst.trim() || gekozen.length || (hele && wie);
  const save = async () => {
    if (!klaarOm) return;
    setBusy(true);
    const ok = await act(async (db) => {
      if (hele && auto) await db.update('autos', auto, { toegewezen_aan: wie || null });
      for (const id of gekozen) await db.update('taken', id, { toegewezen_aan: wie || null, ...(deadline ? { deadline } : {}) });
      if (tekst.trim()) {
        const volgorde = d.taken.filter((x) => (x.auto_id || null) === (auto || null)).length;
        await db.insert('taken', { auto_id: auto || null, tekst: tekst.trim(), uitleg: uitleg.trim() || null, toegewezen_aan: wie || null, deadline: deadline || null, volgorde });
      }
    }, hele && auto ? `Hele auto voor ${naamVan(d, wie)}` : `${gekozen.length + (tekst.trim() ? 1 : 0) === 1 ? '1 taak' : `${gekozen.length + (tekst.trim() ? 1 : 0)} taken`}${wie ? ` voor ${naamVan(d, wie)}` : ''}`, ['taken', 'autos']);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal title={wie ? `Werk voor ${naamVan(d, wie)}` : 'Werk toevoegen'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" disabled={!klaarOm || busy} onClick={save}>
        {hele ? 'Hele auto toewijzen' : gekozen.length && !tekst.trim() ? `${gekozen.length === 1 ? '1 taak' : `${gekozen.length} taken`} toewijzen` : 'Toevoegen'}</button></>}>
      <div className="grid2">
        <Field label="Voor wie"><Sel value={wie} onChange={setWie} empty="Nog niemand" options={werkers(d).map((p) => [p.id, p.naam || p.email])} /></Field>
        <Field label="Klaar voor (optioneel)"><input className="in" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      </div>
      <Field label="Auto">
        <select className="in" value={auto} onChange={(e) => kiesAuto(e.target.value)}>
          <option value="">Algemeen werk (geen auto)</option>
          {autos.map((c) => { const n = d.taken.filter((t) => t.auto_id === c.id && !t.klaar).length; return <option key={c.id} value={c.id}>{carLabel(c)}{n ? ` · ${n} open` : ''}</option>; })}
        </select>
      </Field>
      {auto && geld && (
        <label className={`km-opt${hele ? ' sel' : ''}`}>
          <input type="checkbox" checked={hele} disabled={!wie} onChange={(e) => heleAan(e.target.checked)} />
          <span><b>Hele auto{wie ? ` aan ${naamVan(d, wie)}` : ''} geven</b>
            <small>{wie ? 'Alle open taken gaan naar deze persoon, en nieuwe taken bij deze auto staan voortaan ook op zijn of haar naam.' : 'Kies eerst voor wie.'}{huidig && huidig !== wie ? ` Nu: ${naamVan(d, huidig)}.` : ''}</small></span>
        </label>
      )}
      {auto && (
        <div className="tk-kies">
          <div className="tk-kop"><b>Bestaande taken van deze auto</b>
            {bestaand.length > 1 && !hele && <button type="button" className="linkish" onClick={() => setGekozen(gekozen.length === bestaand.length ? [] : bestaand.map((t) => t.id))}>{gekozen.length === bestaand.length ? 'Niets aanvinken' : 'Alles aanvinken'}</button>}</div>
          {!bestaand.length ? <p className="note" style={{ margin: 0 }}>Deze auto heeft nog geen open taken. Voeg hieronder een nieuwe toe.</p> : bestaand.map((t) => (
            <label key={t.id} className={`tk-r${gekozen.includes(t.id) ? ' sel' : ''}`}>
              <input type="checkbox" checked={gekozen.includes(t.id)} disabled={hele} onChange={() => wissel(t.id)} />
              <span className="tk-t">{t.tekst}</span>
              <Wie d={d} t={t} />
            </label>
          ))}
        </div>
      )}
      <Field label={auto ? 'Nieuwe taak voor deze auto (optioneel)' : 'Wat moet er gebeuren?'}>
        <input className="in" value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder={auto ? 'bijv. olie verversen' : 'bijv. onderdelen ophalen, werkplaats opruimen'} />
      </Field>
      {tekst.trim() && <Field label="Toelichting (optioneel)"><input className="in" value={uitleg} onChange={(e) => setUitleg(e.target.value)} /></Field>}
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
  // Taken per auto bij elkaar; algemeen werk onderaan, auto met de vroegste datum bovenaan
  const groepeer = (ts, wie) => {
    const m = new Map();
    // Auto's die in hun geheel aan deze persoon zijn gegeven, ook zonder open taken
    if (wie) for (const c of d.autos.filter((x) => x.toegewezen_aan === wie && opVoorraad(x))) m.set(c.id, { id: c.id, c, taken: [] });
    for (const t of ts) { const k = t.auto_id || ''; if (!m.has(k)) m.set(k, { id: k, c: k ? d.autoById[k] : null, taken: [] }); m.get(k).taken.push(t); }
    return [...m.values()].sort((a, b) => (!a.id) - (!b.id));
  };
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
            {!groepeer(k.taken, k.id).length ? <p className="note">Geen werk.</p> : groepeer(k.taken, k.id).map((g) => (
              <div key={g.id || 'alg'} className="pg">
                <div className="pg-h">{g.c ? <button className="linkish" onClick={() => openCar(g.c.id)}>{carLabel(g.c)}</button> : <span>Algemeen werk</span>}
                  {g.c && k.id && g.c.toegewezen_aan === k.id && <span className="chip hele">hele auto</span>}</div>
                {g.c && !g.taken.length && <p className="note" style={{ margin: '0 2px' }}>Geen open taken.</p>}
                {g.taken.map((t) => (
                  <div key={t.id} className={`pk${t.klaar ? ' done' : ''}${teLaat(t) ? ' laat' : ''}`}>
                    <input type="checkbox" checked={!!t.klaar} disabled={!werker} onChange={() => toggle(t)} aria-label={`Taak ${t.tekst} afvinken`} />
                    <div className="pk-b">
                      <div className="pk-t">{t.tekst}</div>
                      {t.uitleg && <div className="note">{t.uitleg}</div>}
                      {(t.deadline || (werker && !t.klaar)) && <div className="pk-m">
                        <Deadline t={t} />
                        {werker && !t.klaar && <Wie d={d} t={t} onWijzig={(id) => wijs(t, id)} />}
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {werker && <button className="btn ghost sm pk-add" onClick={() => setForm({ toegewezen_aan: k.id })}>+ Werk{k.id ? ` voor ${k.naam.split(' ')[0]}` : ''}</button>}
          </section>
        ))}
      </div>
      {!taken.length && <div className="pane"><Empty title="Geen open werk">Voeg werk toe met de knop rechtsboven.</Empty></div>}
      {form && <TaakForm preset={form} onClose={() => setForm(null)} />}
    </div>
  );
}
