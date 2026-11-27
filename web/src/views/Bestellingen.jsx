import { useState } from 'react';
import { useApp, Modal, Field, Sel, DelBtn, Empty, useForm } from '../ui';
import { ORDER_ST, carLabel, eur2, fmtD, norm, num, sum, today, safeName, rid, opVoorraad, isCons } from '../lib';

export default function Bestellingen() {
  const { d, openCar } = useApp();
  const [soort, setSoort] = useState('');
  const [st, setSt] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [weergave, setWeergaveRaw] = useState(() => { try { return localStorage.getItem('bestel-weergave') || 'lijst'; } catch { return 'lijst'; } });
  const setWeergave = (v) => { setWeergaveRaw(v); try { localStorage.setItem('bestel-weergave', v); } catch { /* geen opslag */ } };
  const s = norm(q);
  const list = d.bestellingen
    .filter((x) => !soort || (soort === 'los' ? !x.auto_id : !!x.auto_id))
    .filter((x) => !st || x.status === st)
    .filter((x) => !s || norm([x.leverancier, x.omschrijving, x.factuurnr, d.autoById[x.auto_id]?.voorraadnr].join(' ')).includes(s))
    .sort((a, b) => b.datum.localeCompare(a.datum) || (b.aangemaakt || '').localeCompare(a.aangemaakt || ''));
  return (
    <div>
      <div className="filters">
        <div className="wissel" role="group" aria-label="Weergave">
          <button aria-pressed={weergave === 'lijst'} onClick={() => setWeergave('lijst')}>Alle bestellingen</button>
          <button aria-pressed={weergave === 'lev'} onClick={() => setWeergave('lev')}>Per leverancier</button>
        </div>
        <input className="in" style={{ flex: '1 1 200px' }} placeholder="Zoek leverancier, factuurnr, voorraadnr…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoeken" />
        {weergave === 'lijst' && <><Sel value={soort} onChange={setSoort} options={[['auto', 'Aan een auto gekoppeld'], ['los', 'Losse bestellingen']]} empty="Alle bestellingen" aria-label="Soort" />
        <Sel value={st} onChange={setSt} options={ORDER_ST} empty="Elke status" aria-label="Status" /></>}
        <button className="btn primary" onClick={() => setForm({})}>+ Bestelling</button>
      </div>
      {weergave === 'lev' ? <PerLeverancier q={s} onOpen={setForm} /> : <>
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
      </>}
      {form && <BestellingForm order={form.id ? form : null} onClose={() => setForm(null)} />}
    </div>
  );
}

// Alles wat nog binnen moet komen, gegroepeerd per leverancier: onderdelen bij auto's en open bestellingen
function PerLeverancier({ q, onOpen }) {
  const { d, act, openCar } = useApp();
  const groepen = new Map();
  const leg = (naam) => { const k = (naam || '').trim() || ''; if (!groepen.has(k.toLowerCase())) groepen.set(k.toLowerCase(), { naam: k, delen: [], orders: [] }); return groepen.get(k.toLowerCase()); };
  d.onderdelen.filter((o) => o.status !== 'binnen').forEach((o) => leg(o.leverancier).delen.push(o));
  d.bestellingen.filter((b) => b.status === 'besteld').forEach((b) => leg(b.leverancier).orders.push(b));
  const lijst = [...groepen.values()]
    .filter((g) => !q || norm([g.naam, ...g.delen.map((o) => o.onderdeel + ' ' + (d.autoById[o.auto_id]?.voorraadnr || '')), ...g.orders.map((b) => [b.omschrijving, b.factuurnr, d.autoById[b.auto_id]?.voorraadnr].join(' '))].join(' ')).includes(q))
    .sort((a, b) => (!a.naam) - (!b.naam) || a.naam.localeCompare(b.naam, 'nl'));
  const deel = (o, status) => act((db) => db.update('onderdelen', o.id, { status }), `${o.onderdeel}: ${status === 'binnen' ? 'ontvangen' : 'besteld'}`, ['onderdelen']);
  const order = (b) => act((db) => db.update('bestellingen', b.id, { status: 'geleverd' }), 'Ontvangen', ['bestellingen']);
  const allesBinnen = (g) => act(async (db) => {
    for (const o of g.delen.filter((x) => x.status === 'besteld')) await db.update('onderdelen', o.id, { status: 'binnen' });
    for (const b of g.orders) await db.update('bestellingen', b.id, { status: 'geleverd' });
  }, `Alles van ${g.naam || 'deze leverancier'} ontvangen`, ['onderdelen', 'bestellingen']);
  const auto = (id) => { const c = d.autoById[id]; return c ? <button className="linkish" onClick={() => openCar(c.id)}>{carLabel(c)}</button> : <span className="note">Los</span>; };
  if (!lijst.length) return <div className="pane"><Empty title="Niets onderweg">Onderdelen die nog nodig of besteld zijn en open bestellingen verschijnen hier, per leverancier.</Empty></div>;
  return (
    <div className="lev-grid">
      {lijst.map((g) => {
        const teBestellen = g.delen.filter((o) => o.status === 'nodig').length;
        const onderweg = g.delen.filter((o) => o.status === 'besteld').length + g.orders.length;
        return (
          <section key={g.naam || '-'} className="lev">
            <header className="lev-h">
              <div><h3>{g.naam || 'Nog geen leverancier'}</h3>
                <span className="note">{[teBestellen && `${teBestellen} te bestellen`, onderweg && `${onderweg} onderweg`].filter(Boolean).join(' · ')}</span></div>
              {g.naam && onderweg > 1 && <button className="btn sm" onClick={() => allesBinnen(g)}>Alles ontvangen</button>}
            </header>
            <ul className="lev-l">
              {g.delen.map((o) => (
                <li key={o.id}>
                  <div className="lev-w"><b>{o.onderdeel}</b><span className="note">{auto(o.auto_id)}{o.verwacht ? ` · verwacht ${fmtD(o.verwacht)}` : ''}</span></div>
                  {o.status === 'nodig'
                    ? <button className="btn sm" onClick={() => deel(o, 'besteld')}>Besteld</button>
                    : <button className="btn sm primary" onClick={() => deel(o, 'binnen')}>Ontvangen</button>}
                </li>
              ))}
              {g.orders.map((b) => (
                <li key={b.id}>
                  <div className="lev-w"><button className="linkish" onClick={() => onOpen(b)}><b>{b.omschrijving || 'Bestelling'}</b></button>
                    <span className="note">{auto(b.auto_id)} · {fmtD(b.datum)}{b.factuurnr ? ` · ${b.factuurnr}` : ''}{b.bedrag != null ? ` · ${eur2(b.bedrag)}` : ''}</span></div>
                  <button className="btn sm primary" onClick={() => order(b)}>Ontvangen</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
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
