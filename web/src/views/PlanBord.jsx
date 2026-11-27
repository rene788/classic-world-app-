import { useState } from 'react';
import { useApp, Modal, Field, Sel } from '../ui';
import { carLabel, fmtD, isoD, today } from '../lib';
import { werkers, naamVan, teLaat, Wie, Deadline, VoorstelKaart } from './Planning';
import { ReparatieForm, REPL, repOpen } from './Reparaties';

// ---------- weekbord: een rij per persoon, een kolom per dag ----------
// De dag van een kaartje is de "klaar voor"-datum (taken: deadline, reparaties: klaar_voor).

const DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
export const maandagVan = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekNr = (d) => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dag = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - dag); const j = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - j) / 864e5 + 1) / 7); };
const kort = (c) => (c ? [c.voorraadnr ? '#' + c.voorraadnr : null, [c.model, c.type].filter(Boolean).join(' ') || c.merk].filter(Boolean).join(' · ') : 'Algemeen werk');

export function WeekBord({ taken, voorstellen, reparaties, onNieuw }) {
  const { d, act, werker, uid } = useApp();
  const [ma, setMa] = useState(() => maandagVan(new Date()));
  const [open, setOpen] = useState(null); // {soort, item}
  const [over, setOver] = useState(null);
  const vandaag = today();
  const dagen = [...Array(7)].map((_, i) => isoD(plus(ma, i)));
  const [eerste, laatste] = [dagen[0], dagen[6]];
  const dezeWeek = vandaag >= eerste && vandaag <= laatste;
  const mensen = werkers(d);
  const rijId = (id) => (id && mensen.some((p) => p.id === id) ? id : '');

  // Alle kaartjes met hun rij en kolom ('' = zonder datum, 'laat' = van voor deze week en nog open)
  const kaart = [];
  const plaats = (soort, item, wie, dag, klaar) => {
    let kol = dag || '';
    if (dag && dag < eerste) { if (!dezeWeek || klaar) return; kol = 'laat'; }
    else if (dag && dag > laatste) return;
    else if (!dag && klaar) return;
    kaart.push({ soort, item, rij: rijId(wie), kol });
  };
  taken.forEach((t) => plaats('taak', t, t.toegewezen_aan, t.deadline, t.klaar));
  reparaties.filter(repOpen).forEach((r) => plaats('rep', r, r.toegewezen_aan, r.klaar_voor, false));
  voorstellen.filter((t) => t.voorstel === 'open').forEach((t) => plaats('vs', t, t.voorgesteld_door, t.deadline, false));

  const weekend = kaart.some((k) => k.kol === dagen[5] || k.kol === dagen[6]);
  // Links wat nog ingepland moet worden (en wat te laat is), daarna de dagen; het weekend alleen als er iets op staat
  const kolommen = [{ k: '', l: 'Nog inplannen', sub: 'zonder datum', w: 'minmax(150px, 1fr)' },
    ...(kaart.some((k) => k.kol === 'laat') ? [{ k: 'laat', l: 'Te laat', sub: 'van eerder', w: 'minmax(140px, 1fr)' }] : []),
    ...dagen.slice(0, weekend ? 7 : 5).map((x, i) => ({ k: x, l: `${DAGEN[i]} ${+x.slice(8)}`, sub: x === vandaag ? 'vandaag' : '', w: i > 4 ? 'minmax(120px, .8fr)' : 'minmax(140px, 1fr)' }))];
  const rijen = [...mensen.map((p) => ({ id: p.id, naam: p.naam || p.email })), { id: '', naam: 'Nog niemand' }]
    .filter((r) => r.id || kaart.some((k) => k.rij === ''));

  const verplaats = (sleutel, rij, kol) => {
    const [soort, id] = sleutel.split(':');
    if (kol === 'laat') return;
    const wie = rij || null; const dag = kol || null;
    if (soort === 'taak') {
      const t = taken.find((x) => x.id === id); if (!t || ((t.toegewezen_aan || null) === wie && (t.deadline || null) === dag)) return;
      act((db) => db.update('taken', id, { toegewezen_aan: wie, deadline: dag }), `${t.tekst}: ${wie ? naamVan(d, wie) : 'nog niemand'}${dag ? `, ${DAGEN[(new Date(dag + 'T12:00').getDay() + 6) % 7]} ${fmtD(dag)}` : ', zonder datum'}`, ['taken']);
    } else if (soort === 'rep') {
      const r = reparaties.find((x) => x.id === id); if (!r) return;
      act((db) => db.update('reparaties', id, { toegewezen_aan: wie, klaar_voor: dag }), `Reparatie R${r.nr} verplaatst`, ['reparaties']);
    }
  };
  const tel = (rij) => kaart.filter((k) => k.rij === rij && k.soort !== 'vs' && !(k.soort === 'taak' && k.item.klaar)).length;

  return (
    <div className="wb-wrap">
      <div className="wb-nav">
        <button className="btn sm" onClick={() => setMa(plus(ma, -7))} aria-label="Vorige week">‹</button>
        <b>Week {weekNr(ma)}</b><span className="note">{fmtD(eerste)} – {fmtD(dagen[weekend ? 6 : 4])}</span>
        <button className="btn sm" onClick={() => setMa(plus(ma, 7))} aria-label="Volgende week">›</button>
        {!dezeWeek && <button className="btn ghost sm" onClick={() => setMa(maandagVan(new Date()))}>Deze week</button>}
        {werker && <span className="note wb-tip">Sleep een kaartje naar een andere dag of persoon, of tik erop om het aan te passen.</span>}
      </div>
      <div className="wb-scroll">
        <div className="wb" style={{ gridTemplateColumns: `128px ${kolommen.map((k) => k.w).join(' ')}` }}>
          <div className="wb-hoek" />
          {kolommen.map((k) => <div key={k.k || 'geen'} className={`wb-dag${k.k === vandaag ? ' vd' : ''}${k.k === 'laat' ? ' laat' : ''}${k.k === '' ? ' los' : ''}`}>{k.l}{k.sub && <small>{k.sub}</small>}</div>)}
          {rijen.map((r) => (
            <Rij key={r.id || 'niemand'} r={r} ik={r.id === uid} n={tel(r.id)}>
              {kolommen.map((k) => {
                const hier = kaart.filter((x) => x.rij === r.id && x.kol === k.k);
                const cel = `${r.id}|${k.k}`;
                const kanDrop = werker && k.k !== 'laat';
                return (
                  <div key={cel} className={`wb-cel${k.k === vandaag ? ' vd' : ''}${over === cel ? ' over' : ''}${k.k === 'laat' ? ' laat' : ''}${k.k === '' ? ' los' : ''}`}
                    onDragOver={kanDrop ? (e) => { e.preventDefault(); if (over !== cel) setOver(cel); } : undefined}
                    onDragLeave={kanDrop ? () => setOver((o) => (o === cel ? null : o)) : undefined}
                    onDrop={kanDrop ? (e) => { e.preventDefault(); setOver(null); verplaats(e.dataTransfer.getData('text/plain'), r.id, k.k); } : undefined}>
                    {hier.map((x) => <Kaartje key={x.soort + x.item.id} x={x} d={d} sleep={werker && x.soort !== 'vs'} onOpen={() => setOpen(x)} />)}
                    {werker && k.k !== 'laat' && <button className="wb-plus" onClick={() => onNieuw({ toegewezen_aan: r.id, deadline: k.k })} aria-label={`Werk toevoegen voor ${r.naam}${k.k ? ' op ' + fmtD(k.k) : ''}`}>+</button>}
                  </div>
                );
              })}
            </Rij>
          ))}
        </div>
      </div>
      <div className="wb-legenda note"><span><i className="lg lg-laat" />te laat</span><span><i className="lg lg-rep" />klantreparatie</span><span><i className="lg lg-vs" />voorstel, wacht op akkoord</span></div>
      {open?.soort === 'taak' && <TaakDetail t={open.item} onClose={() => setOpen(null)} />}
      {open?.soort === 'rep' && <ReparatieForm rep={open.item} onClose={() => setOpen(null)} />}
      {open?.soort === 'vs' && <Modal title="Voorstel" onClose={() => setOpen(null)}><VoorstelKaart t={open.item} /></Modal>}
    </div>
  );
}

const Rij = ({ r, ik, n, children }) => (
  <>
    <div className={`wb-wie${ik ? ' ik' : ''}${r.id ? '' : ' niemand'}`}>
      <span className="wb-av" aria-hidden="true">{r.id ? (r.naam || '?').trim()[0].toUpperCase() : '?'}</span>
      <span><b>{r.naam}{ik ? ' (jij)' : ''}</b><small>{n ? `${n} open` : 'vrij'}</small></span>
    </div>
    {children}
  </>
);

function Kaartje({ x, d, sleep, onOpen }) {
  const { soort, item } = x;
  const c = item.auto_id && d.autoById[item.auto_id];
  const laat = soort === 'taak' ? teLaat(item) : soort === 'rep' ? item.klaar_voor && item.klaar_voor < today() && item.status !== 'klaar' : false;
  const titel = soort === 'rep' ? item.omschrijving : item.tekst;
  const sub = soort === 'rep' ? `R${item.nr} · ${item.auto}${item.klant_naam ? ' · ' + item.klant_naam : ''}` : kort(c);
  return (
    <button className={`wbk ${soort}${laat ? ' laat' : ''}${item.klaar ? ' klaar' : ''}`} draggable={sleep}
      onDragStart={sleep ? (e) => { e.dataTransfer.setData('text/plain', `${soort}:${item.id}`); e.dataTransfer.effectAllowed = 'move'; } : undefined}
      onClick={onOpen} title={titel}>
      <b>{item.klaar ? '✓ ' : ''}{titel}</b>
      <span>{sub}</span>
      {soort === 'rep' && <em>{REPL[item.status]}</em>}
      {soort === 'vs' && <em>voorstel</em>}
    </button>
  );
}

// Eén taak bekijken en aanpassen: wie, wanneer, afvinken
export function TaakDetail({ t, onClose }) {
  const { d, act, werker, uid, openCar } = useApp();
  const [wie, setWie] = useState(t.toegewezen_aan || '');
  const [dag, setDag] = useState(t.deadline || '');
  const c = t.auto_id && d.autoById[t.auto_id];
  const opslaan = async () => {
    if (await act((db) => db.update('taken', t.id, { toegewezen_aan: wie || null, deadline: dag || null }), 'Taak bijgewerkt', ['taken'])) onClose();
  };
  const vink = async () => {
    if (await act((db) => db.update('taken', t.id, { klaar: !t.klaar, klaar_door: !t.klaar ? uid : null, klaar_op: !t.klaar ? new Date().toISOString() : null }), t.klaar ? 'Weer open gezet' : 'Taak afgevinkt', ['taken'])) onClose();
  };
  return (
    <Modal title={t.tekst} onClose={onClose}
      footer={werker ? <>
        <button className="btn" style={{ marginRight: 'auto' }} onClick={vink}>{t.klaar ? 'Weer open zetten' : '✓ Afvinken'}</button>
        <button className="btn" onClick={onClose}>Annuleren</button>
        <button className="btn primary" onClick={opslaan}>Opslaan</button>
      </> : <button className="btn" onClick={onClose}>Sluiten</button>}>
      <div className="pk-m">
        {c ? <button className="linkish" onClick={() => { onClose(); openCar(c.id); }}>{carLabel(c)}</button> : <span className="chip">Algemeen werk</span>}
        <Deadline t={t} />
        {t.klaar && <span className="chip ok">klaar{t.klaar_door ? ` · ${naamVan(d, t.klaar_door)}` : ''}</span>}
      </div>
      {t.uitleg && <p style={{ margin: 0 }}>{t.uitleg}</p>}
      {werker ? (
        <div className="grid2">
          <Field label="Voor wie"><Sel value={wie} onChange={setWie} empty="Nog niemand" options={werkers(d).map((p) => [p.id, p.naam || p.email])} /></Field>
          <Field label="Klaar voor"><input className="in" type="date" value={dag} onChange={(e) => setDag(e.target.value)} /></Field>
        </div>
      ) : <Wie d={d} t={t} />}
    </Modal>
  );
}

// ---------- per auto: alle open werk gegroepeerd per auto ----------
export function PerAuto({ taken, onNieuw }) {
  const { d, act, werker, uid, openCar } = useApp();
  const groepen = new Map();
  for (const t of taken) { const k = t.auto_id || ''; if (!groepen.has(k)) groepen.set(k, []); groepen.get(k).push(t); }
  const lijst = [...groepen.entries()].map(([k, ts]) => ({ k, c: k ? d.autoById[k] : null, ts }))
    .sort((a, b) => (!a.k) - (!b.k) || (b.ts.some(teLaat) - a.ts.some(teLaat)) || String(a.c?.voorraadnr || '').localeCompare(String(b.c?.voorraadnr || ''), 'nl', { numeric: true }));
  const toggle = (t) => act((db) => db.update('taken', t.id, { klaar: !t.klaar, klaar_door: !t.klaar ? uid : null, klaar_op: !t.klaar ? new Date().toISOString() : null }), t.klaar ? null : 'Taak afgevinkt', ['taken']);
  const wijs = (t, id) => act((db) => db.update('taken', t.id, { toegewezen_aan: id }), id ? `Toegewezen aan ${naamVan(d, id)}` : 'Toewijzing weggehaald', ['taken']);
  return (
    <div className="pa-grid">
      {lijst.map(({ k, c, ts }) => (
        <section key={k || 'alg'} className="plan-k">
          <div className="pa-h">
            {c ? <button className="linkish" onClick={() => openCar(c.id)}>{carLabel(c)}</button> : <b>Algemeen werk</b>}
            <span className="count num">{ts.filter((t) => !t.klaar).length}</span>
            {c?.toegewezen_aan && <span className="chip hele">hele auto: {naamVan(d, c.toegewezen_aan)}</span>}
          </div>
          {ts.map((t) => (
            <div key={t.id} className={`pk${t.klaar ? ' done' : ''}${teLaat(t) ? ' laat' : ''}`}>
              <input type="checkbox" checked={!!t.klaar} disabled={!werker} onChange={() => toggle(t)} aria-label={`Taak ${t.tekst} afvinken`} />
              <div className="pk-b">
                <div className="pk-t">{t.tekst}</div>
                <div className="pk-m"><Deadline t={t} /><Wie d={d} t={t} onWijzig={werker && !t.klaar ? (id) => wijs(t, id) : null} /></div>
              </div>
            </div>
          ))}
          {werker && <button className="btn ghost sm pk-add" onClick={() => onNieuw(k ? { auto_id: k } : {})}>+ Werk{c ? ' bij deze auto' : ''}</button>}
        </section>
      ))}
    </div>
  );
}
