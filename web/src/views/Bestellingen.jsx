import { useState } from 'react';
import { useApp, Modal, Field, Sel, DelBtn, Empty, useForm } from '../ui';
import { ORDER_ST, carLabel, eur2, fmtD, norm, num, sum, today, safeName, rid, opVoorraad, isCons } from '../lib';

export default function Bestellingen() {
  const { d, openCar } = useApp();
  const [soort, setSoort] = useState('');
  const [st, setSt] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const s = norm(q);
  const list = d.bestellingen
    .filter((x) => !soort || (soort === 'los' ? !x.auto_id : !!x.auto_id))
    .filter((x) => !st || x.status === st)
    .filter((x) => !s || norm([x.leverancier, x.omschrijving, x.factuurnr, d.autoById[x.auto_id]?.voorraadnr].join(' ')).includes(s))
    .sort((a, b) => b.datum.localeCompare(a.datum) || (b.aangemaakt || '').localeCompare(a.aangemaakt || ''));
  return (
    <div>
      <div className="filters">
        <input className="in" style={{ flex: '1 1 200px' }} placeholder="Zoek leverancier, factuurnr, voorraadnr…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoeken" />
        <Sel value={soort} onChange={setSoort} options={[['auto', 'Aan een auto gekoppeld'], ['los', 'Losse bestellingen']]} empty="Alle bestellingen" aria-label="Soort" />
        <Sel value={st} onChange={setSt} options={ORDER_ST} empty="Elke status" aria-label="Status" />
        <button className="btn primary" onClick={() => setForm({})}>+ Bestelling</button>
      </div>
      <div className="totals">
        <dl className="tot"><dt>Totaal in lijst</dt><dd className="num">{eur2(sum(list, (x) => x.bedrag)) || '€ 0'}</dd></dl>
        <dl className="tot"><dt>Nog niet betaald</dt><dd className="num">{eur2(sum(list.filter((x) => x.status !== 'betaald'), (x) => x.bedrag)) || '€ 0'}</dd></dl>
      </div>
      {!list.length ? <div className="pane"><Empty title="Geen bestellingen">Leg bestellingen en facturen vast. Koppel ze aan een voorraadnummer, of laat de auto leeg voor een losse bestelling.</Empty></div> : (
        <div className="tw"><table>
          <thead><tr><th>Datum</th><th>Leverancier</th><th>Omschrijving</th><th>Auto</th><th>Factuurnr</th><th>Status</th><th className="r">Bedrag</th></tr></thead>
          <tbody>{list.map((x) => {
            const c = d.autoById[x.auto_id];
            return (
              <tr key={x.id} className="click" onClick={() => setForm(x)}>
                <td>{fmtD(x.datum)}</td><td>{x.leverancier || '—'}</td>
                <td>{x.omschrijving || '—'}{x.voor_klant && <span className="chip match" style={{ marginLeft: 6 }}>voor klant</span>}{x.bestand && <span className="chip" style={{ marginLeft: 6 }}>factuur</span>}</td>
                <td>{c ? <button className="linkish" onClick={(e) => { e.stopPropagation(); openCar(c.id); }}>{carLabel(c)}</button> : <span className="note">Los</span>}</td>
                <td className="mono">{x.factuurnr || ''}</td>
                <td>{Object.fromEntries(ORDER_ST)[x.status]}</td>
                <td className="r num">{eur2(x.bedrag)}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      {form && <BestellingForm order={form.id ? form : null} onClose={() => setForm(null)} />}
    </div>
  );
}

export function BestellingForm({ order, preset, onClose }) {
  const { d, act } = useApp();
  const o = order || {};
  const [f, set, setF] = useForm({
    auto_id: o.auto_id ?? preset?.auto_id ?? '', leverancier: o.leverancier ?? '', omschrijving: o.omschrijving ?? '', factuurnr: o.factuurnr ?? '',
    bedrag: o.bedrag != null ? String(o.bedrag).replace('.', ',') : '', datum: o.datum ?? today(), status: o.status ?? 'besteld', voor_klant: o.voor_klant ?? !!(d.autoById[o.auto_id ?? preset?.auto_id] && isCons(d.autoById[o.auto_id ?? preset?.auto_id])),
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const row = { auto_id: f.auto_id || null, leverancier: f.leverancier.trim() || null, omschrijving: f.omschrijving.trim() || null, factuurnr: f.factuurnr.trim() || null,
      bedrag: num(f.bedrag), datum: f.datum, status: f.status, voor_klant: f.voor_klant };
    const ok = await act(async (db) => {
      if (file) {
        const pad = `geld/bestellingen/${rid().slice(0, 8)}-${safeName(file.name)}`;
        await db.upload(pad, file);
        row.bestand = pad;
      }
      return order ? db.update('bestellingen', order.id, row) : db.insert('bestellingen', row);
    }, order ? 'Bestelling bijgewerkt' : 'Bestelling toegevoegd', ['bestellingen']);
    setBusy(false);
    if (ok) onClose();
  };
  const open = async () => { const m = await act((db) => db.urls([o.bestand])); if (m && m[o.bestand]) window.open(m[o.bestand], '_blank', 'noopener'); };
  const del = async () => { if (await act(async (db) => { await db.remove('bestellingen', o.id); if (o.bestand) { try { await db.removeFile(o.bestand); } catch { /* al weg */ } } }, 'Verwijderd', ['bestellingen'])) onClose(); };
  const autos = d.autos.filter((c) => opVoorraad(c) || c.id === f.auto_id);

  return (
    <Modal title={order ? 'Bestelling' : 'Bestelling toevoegen'} onClose={onClose}
      footer={<>{order && <span style={{ marginRight: 'auto' }}><DelBtn onConfirm={del} /></span>}<button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Opslaan…' : 'Opslaan'}</button></>}>
      <Field label="Voorraadnummer / auto"><Sel value={f.auto_id} onChange={(v) => setF((x) => ({ ...x, auto_id: v, ...(order ? {} : { voor_klant: !!(d.autoById[v] && isCons(d.autoById[v])) }) }))} options={autos.map((c) => [c.id, carLabel(c)])} empty="Losse bestelling (geen auto)" style={{ width: '100%' }} /></Field>
      <div className="grid2">
        <Field label="Leverancier"><input className="in" value={f.leverancier} onChange={set('leverancier')} autoFocus /></Field>
        <Field label="Factuurnummer"><input className="in mono" value={f.factuurnr} onChange={set('factuurnr')} /></Field>
        <Field label="Bedrag (€)"><input className="in" inputMode="decimal" value={f.bedrag} onChange={set('bedrag')} /></Field>
        <Field label="Datum"><input className="in" type="date" value={f.datum} onChange={set('datum')} /></Field>
        <Field label="Status"><Sel value={f.status} onChange={set('status')} options={ORDER_ST} /></Field>
      </div>
      <Field label="Omschrijving"><input className="in" value={f.omschrijving} onChange={set('omschrijving')} placeholder="bijv. remset, koppelingsplaat" /></Field>
      <label className="chk"><input type="checkbox" checked={f.voor_klant} onChange={set('voor_klant')} /> Door te belasten aan de klant</label>
      <div className="upl">
        {o.bestand && <button type="button" className="btn" onClick={open}>Factuur openen</button>}
        <label className="btn filebtn">{file ? file.name : o.bestand ? 'Andere factuur kiezen' : '+ Factuur (PDF of foto)'}
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
      </div>
    </Modal>
  );
}
