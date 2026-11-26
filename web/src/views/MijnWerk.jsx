import { useEffect, useState } from 'react';
import { useApp, Modal, Field, Sel, Plate, Nr, Empty } from '../ui';
import { Wie, Deadline } from './Planning';
import { carLabel, carName, elapsed, fmtD, hrs, sum, today, numDec, periodRange, opVoorraad, isCons } from '../lib';

export default function MijnWerk() {
  const { d, act, uid, me, werker, openCar, go } = useApp();
  const [form, setForm] = useState(false);
  const [alleen, setAlleen] = useState(true);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  const klok = d.klokken.find((k) => k.monteur_id === uid);
  const actief = d.autos.filter(opVoorraad).sort((a, b) => String(a.voorraadnr || '').localeCompare(String(b.voorraadnr || ''), 'nl', { numeric: true }));
  const [auto, setAuto] = useState('');
  const [oms, setOms] = useState('');
  const [klant, setKlant] = useState(false);

  const start = () => act((db) => db.insert('klokken', { monteur_id: uid, auto_id: auto || null, omschrijving: oms.trim() || null, voor_klant: klant, gestart_op: new Date().toISOString() }), 'Klok gestart', ['klokken']);
  const stop = async () => {
    const h = Math.min(24, Math.max(0.25, Math.round(((Date.now() - new Date(klok.gestart_op)) / 36e5) * 4) / 4));
    const ok = await act(async (db) => {
      await db.insert('uren', { auto_id: klok.auto_id, monteur_id: uid, datum: today(), uren: h, omschrijving: klok.omschrijving, voor_klant: klok.voor_klant, status: me.rol === 'beheerder' ? 'goedgekeurd' : 'ingediend' });
      await db.remove('klokken', uid);
    }, `${hrs(h)} uur opgeslagen`, ['uren', 'klokken']);
    if (ok) { setOms(''); setKlant(false); }
  };
  const cancel = () => act((db) => db.remove('klokken', uid), 'Klok gestopt zonder uren op te slaan', ['klokken']);

  const [wa, wb] = periodRange('week');
  const mijn = d.uren.filter((h) => h.monteur_id === uid);
  const vandaag = sum(mijn.filter((h) => h.datum === today()), (h) => h.uren);
  const week = sum(mijn.filter((h) => h.datum >= wa && h.datum <= wb), (h) => h.uren);

  const naam = (me?.naam || '').toLowerCase();
  const vanMij = (t) => t.toegewezen_aan === uid || (!t.toegewezen_aan && naam && (t.monteur || '').toLowerCase().includes(naam));
  const volg = (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || (a.volgorde - b.volgorde);
  const open = d.taken.filter((t) => !t.klaar && (!alleen || vanMij(t))).sort(volg);
  const algemeen = open.filter((t) => !t.auto_id);
  const perAuto = actief.map((c) => ({ c, taken: open.filter((t) => t.auto_id === c.id) })).filter((x) => x.taken.length || (alleen && x.c.toegewezen_aan === uid))
    .sort((a, b) => (!a.taken.length) - (!b.taken.length) || (a.taken.length && b.taken.length ? volg(a.taken[0], b.taken[0]) : 0));
  const toggle = (t) => act((db) => db.update('taken', t.id, { klaar: !t.klaar, klaar_door: !t.klaar ? uid : null, klaar_op: !t.klaar ? new Date().toISOString() : null }), t.klaar ? null : 'Taak afgevinkt', ['taken']);

  if (!werker) return <Empty title="Geen werk">Je account kan geen uren of taken bijhouden.</Empty>;
  const kc = klok && d.autoById[klok.auto_id];

  return (
    <div>
      <div className="clock">
        {klok ? <>
          <div>
            <div style={{ fontWeight: 600 }}>Klok loopt{kc ? ` · ${carLabel(kc)}` : ' · algemeen werk'}</div>
            <div className="big num">{elapsed(klok.gestart_op)}</div>
            <div style={{ opacity: 0.85 }}>{klok.omschrijving || ''}{klok.voor_klant ? ' · voor de klant' : ''}</div>
          </div>
          <div className="d-actions">
            <button className="btn lg" onClick={stop}>Stop en sla op</button>
            <button className="btn sm" onClick={cancel}>Annuleren</button>
          </div>
        </> : <>
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Klok starten</div>
            <select className="in" style={{ width: '100%' }} value={auto} onChange={(e) => { setAuto(e.target.value); setKlant(!!(d.autoById[e.target.value] && isCons(d.autoById[e.target.value]))); }} aria-label="Auto">
              <option value="">Algemeen werk (geen auto)</option>
              {actief.map((c) => <option key={c.id} value={c.id}>{carLabel(c)}</option>)}
            </select>
            <input className="in" value={oms} onChange={(e) => setOms(e.target.value)} placeholder="Wat ga je doen? (optioneel)" aria-label="Omschrijving" />
            <label className="chk"><input type="checkbox" checked={klant} onChange={(e) => setKlant(e.target.checked)} /> Kosten voor de klant</label>
          </div>
          <button className="btn lg" onClick={start}>▶ Start</button>
        </>}
      </div>

      <div className="totals">
        <dl className="tot"><dt>Vandaag</dt><dd className="num">{hrs(vandaag)} u</dd></dl>
        <dl className="tot"><dt>Deze week</dt><dd className="num">{hrs(week)} u</dd></dl>
        <button className="btn" style={{ alignSelf: 'center' }} onClick={() => setForm(true)}>+ Uren invullen</button>
      </div>

      <div className="filters">
        <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 18, margin: 0 }}>Open taken</h2>
        <label className="chk" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={alleen} onChange={(e) => setAlleen(e.target.checked)} /> Alleen voor mij</label>
      </div>
      {algemeen.length > 0 && (
        <div className="wcard">
          <div className="wcard-h"><h3>Algemeen werk</h3><div className="d-actions"><button className="btn sm" onClick={() => go('planning')}>Planning</button></div></div>
          {algemeen.map((t) => (
            <label key={t.id} className="wtodo">
              <input type="checkbox" checked={!!t.klaar} onChange={() => toggle(t)} />
              <span>{t.tekst}{t.uitleg && <span className="note"> — {t.uitleg}</span>} <Deadline t={t} />{!alleen && <Wie d={d} t={t} />}</span>
            </label>
          ))}
        </div>
      )}
      {!perAuto.length && !algemeen.length ? <div className="pane"><Empty title="Geen open taken">{alleen ? 'Er staan geen taken op jouw naam.' : 'Alle taken zijn af.'}</Empty></div>
        : perAuto.map(({ c, taken }) => (
          <div key={c.id} className="wcard">
            <div className="wcard-h">
              <h3>{carName(c)}</h3>
              <div className="d-actions"><Nr c={c} /><Plate c={c} /><button className="btn sm" onClick={() => openCar(c.id)}>Dossier</button></div>
            </div>
            {!taken.length && <p className="note" style={{ margin: '4px 0 0' }}>Deze auto is aan jou gegeven. Er staan nu geen open taken.</p>}
            {taken.map((t) => (
              <label key={t.id} className="wtodo">
                <input type="checkbox" checked={!!t.klaar} onChange={() => toggle(t)} />
                <span>{t.tekst}{t.uitleg && <span className="note"> — {t.uitleg}</span>} <Deadline t={t} />{!alleen && <Wie d={d} t={t} />}</span>
              </label>
            ))}
          </div>
        ))}
      {form && <UrenForm onClose={() => setForm(false)} />}
    </div>
  );
}

// Uren invullen of (beheerder) wijzigen
export function UrenForm({ carId, onClose, edit }) {
  const { d, act, uid, beheerder } = useApp();
  const actief = d.autos.filter((c) => opVoorraad(c) || c.id === carId || c.id === edit?.auto_id);
  const [auto, setAuto] = useState(edit?.auto_id ?? carId ?? '');
  const [datum, setDatum] = useState(edit?.datum ?? today());
  const [uren, setUren] = useState(edit ? String(edit.uren).replace('.', ',') : '');
  const [oms, setOms] = useState(edit?.omschrijving ?? '');
  const [klant, setKlant] = useState(edit?.voor_klant ?? !!(d.autoById[edit?.auto_id ?? carId] && isCons(d.autoById[edit?.auto_id ?? carId])));
  const [mon, setMon] = useState(edit?.monteur_id ?? uid);
  const werkers = d.profielen.filter((p) => ['beheerder', 'verkoop', 'monteur'].includes(p.rol));
  const u = numDec(uren);
  const valid = u != null && u > 0 && u <= 24;

  const save = async () => {
    if (!valid) return;
    const row = { auto_id: auto || null, datum, uren: u, omschrijving: oms.trim() || null, voor_klant: klant };
    const ok = edit
      ? await act((db) => db.update('uren', edit.id, { ...row, monteur_id: mon }), 'Uren aangepast', ['uren'])
      : await act((db) => db.insert('uren', { ...row, monteur_id: beheerder ? mon : uid, status: beheerder ? 'goedgekeurd' : 'ingediend' }), beheerder ? 'Uren opgeslagen' : 'Uren gemeld, wacht op goedkeuring', ['uren']);
    if (ok) onClose();
  };

  return (
    <Modal title={edit ? 'Uren wijzigen' : 'Uren invullen'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" disabled={!valid} onClick={save}>Opslaan</button></>}>
      <Field label="Auto">
        <select className="in" style={{ width: '100%' }} value={auto} onChange={(e) => { setAuto(e.target.value); if (!edit) setKlant(!!(d.autoById[e.target.value] && isCons(d.autoById[e.target.value]))); }}>
          <option value="">Algemeen werk (geen auto)</option>
          {actief.map((c) => <option key={c.id} value={c.id}>{carLabel(c)}</option>)}
        </select>
      </Field>
      <div className="grid2">
        {beheerder && <Field label="Medewerker"><Sel value={mon} onChange={setMon} options={werkers.map((p) => [p.id, p.naam || p.email])} /></Field>}
        <Field label="Datum"><input className="in" type="date" value={datum} max={today()} onChange={(e) => setDatum(e.target.value)} /></Field>
        <Field label="Aantal uur (bijv. 2,5)"><input className="in" inputMode="decimal" value={uren} onChange={(e) => setUren(e.target.value)} autoFocus /></Field>
      </div>
      <Field label="Wat heb je gedaan?"><input className="in" value={oms} onChange={(e) => setOms(e.target.value)} /></Field>
      <label className="chk"><input type="checkbox" checked={klant} onChange={(e) => setKlant(e.target.checked)} /> Deze uren zijn kosten voor de klant</label>
      {!beheerder && <p className="hint">Na opslaan kun je deze uren niet meer zelf wijzigen. De beheerder keurt ze goed{edit ? '' : ` (${fmtD(datum)})`}.</p>}
    </Modal>
  );
}
