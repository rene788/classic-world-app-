import { useState } from 'react';
import { useApp, Status, Empty, CarFoto, useUrls } from '../ui';
import { carLabel, fmtD, daysSince, opVoorraad, norm, LOCL } from '../lib';
import { naamVan, teLaat, TaakForm } from './Planning';
import { REPL, repOpen } from './Reparaties';

// Eén regel per auto die in de werkplaats is of nog werk heeft, plus lopende klantreparaties.
export function werkplaatsRijen(d) {
  const rijen = [];
  for (const c of d.autos) {
    if (!opVoorraad(c) || c.status === 'onderweg') continue;
    const taken = d.taken.filter((t) => t.auto_id === c.id && !t.klaar);
    const parts = d.onderdelen.filter((o) => o.auto_id === c.id && o.status !== 'binnen');
    if (c.status !== 'werkplaats' && c.locatie !== 'werkplaats' && !taken.length && !parts.length) continue;
    const wie = [...new Set(taken.map((t) => naamVan(d, t.toegewezen_aan) || t.monteur).filter(Boolean))];
    const nu = (d.klokken || []).filter((k) => k.auto_id === c.id).map((k) => naamVan(d, k.monteur_id));
    const sinds = [c.datum_binnen, ...taken.map((t) => t.aangemaakt)].filter(Boolean).map((x) => String(x).slice(0, 10)).sort()[0] || null;
    rijen.push({ key: c.id, c, taken, parts, wie, nu, sinds, laat: taken.some(teLaat) });
  }
  for (const r of d.reparaties || []) {
    if (!repOpen(r)) continue;
    rijen.push({ key: 'r' + r.id, r, wie: [naamVan(d, r.toegewezen_aan)].filter(Boolean), nu: [], sinds: r.binnen_op || String(r.aangemaakt || '').slice(0, 10) || null, laat: r.klaar_voor && r.klaar_voor < new Date().toISOString().slice(0, 10) && r.status !== 'klaar' });
  }
  return rijen.sort((a, b) => (b.laat - a.laat) || (b.nu.length - a.nu.length) || (a.sinds || '9').localeCompare(b.sinds || '9'));
}

export default function Werkplaats() {
  const { d, go, openCar, werker, geld } = useApp();
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [soort, setSoort] = useState('');
  const s = norm(q);
  const alle = werkplaatsRijen(d);
  const rijen = alle
    .filter((x) => !soort || (soort === 'rep' ? x.r : x.c))
    .filter((x) => !s || norm(x.c ? [x.c.voorraadnr, x.c.merk, x.c.model, x.c.type, x.c.kenteken, ...x.taken.map((t) => t.tekst), ...x.wie].join(' ') : [x.r.nr, x.r.auto, x.r.klant_naam, x.r.kenteken, x.r.omschrijving].join(' ')).includes(s));
  const fotos = useUrls(rijen.map((x) => x.c?.foto).filter(Boolean));
  const telAuto = alle.filter((x) => x.c).length;
  const telRep = alle.length - telAuto;
  const wachten = alle.filter((x) => (x.parts || []).some((o) => o.status !== 'binnen') || x.r?.status === 'wacht').length;

  return (
    <div>
      <div className="totals">
        <dl className="tot"><dt>Eigen auto's met werk</dt><dd className="num">{telAuto}</dd></dl>
        <dl className="tot"><dt>Klantreparaties</dt><dd className="num">{telRep}</dd></dl>
        <dl className="tot"><dt>Wacht op onderdelen</dt><dd className="num">{wachten}</dd></dl>
      </div>
      <div className="filters">
        <input className="in" style={{ flex: '1 1 200px' }} placeholder="Zoek auto, taak, monteur…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoeken" />
        <div className="wissel" role="group" aria-label="Soort">
          {[['', 'Alles'], ['auto', 'Eigen auto\'s'], ['rep', 'Reparaties']].map(([k, l]) => <button key={k} aria-pressed={soort === k} onClick={() => setSoort(k)}>{l}</button>)}
        </div>
        {werker && <button className="btn" onClick={() => go('planning')}>Naar planning</button>}
        {werker && <button className="btn primary" onClick={() => setForm({})}>{geld ? '+ Werk toevoegen' : '+ Werk voorstellen'}</button>}
      </div>
      {!rijen.length ? <div className="pane"><Empty title="Werkplaats is leeg">Auto's met open taken, bestelde onderdelen of status 'In werkplaats' verschijnen hier vanzelf.</Empty></div> : (
        <div className="tw"><table className="wp-tabel">
          <thead><tr><th>Auto</th><th>Wat</th><th>Wie</th><th>Status</th><th>Wacht op</th><th>Sinds</th>{werker && <th className="wp-act"><span className="sr-only">Acties</span></th>}</tr></thead>
          <tbody>{rijen.map((x) => x.c ? (
            <tr key={x.key} className={`click${x.laat ? ' rij-laat' : ''}`} onClick={() => openCar(x.c.id)}>
              <td><div className="wp-auto"><CarFoto c={x.c} url={fotos[x.c.foto]} sm /><span>{carLabel(x.c)}<span className="note">{x.c.locatie ? LOCL[x.c.locatie] || x.c.locatie : ''}</span></span></div></td>
              <td>{x.taken.length ? <>{x.taken[0].tekst}{x.taken.length > 1 && <span className="note"> + {x.taken.length - 1} meer</span>}</> : <span className="note">Geen open taken</span>}</td>
              <td>{x.nu.length ? <span className="chip live">● {x.nu.join(', ')}</span> : x.wie.length ? x.wie.join(', ') : <span className="note">Nog niemand</span>}</td>
              <td><Status s={x.c.status} />{x.laat && <span className="chip bad" style={{ marginLeft: 6 }}>te laat</span>}</td>
              <td>{x.parts.length ? x.parts.map((o) => <div key={o.id} className="wp-part"><span className={`chip${o.status === 'nodig' ? ' warn' : ''}`}>{o.status === 'nodig' ? 'te bestellen' : 'besteld'}</span> {o.onderdeel}{o.verwacht && <span className="note"> · {fmtD(o.verwacht)}</span>}</div>) : <span className="note">—</span>}</td>
              <td className="wp-sinds">{x.sinds ? <>{fmtD(x.sinds)}<span className="note">{daysSince(x.sinds) === 1 ? '1 dag' : `${daysSince(x.sinds)} dagen`}</span></> : '—'}</td>
              {werker && <td className="wp-act"><button className="btn sm" onClick={(e) => { e.stopPropagation(); setForm({ auto_id: x.c.id }); }}>{geld ? '+ Werk' : '+ Voorstel'}</button></td>}
            </tr>
          ) : (
            <tr key={x.key} className={`click${x.laat ? ' rij-laat' : ''}`} onClick={() => go('reparaties')}>
              <td><div className="wp-auto"><span className="cfoto sm leeg rep-foto" aria-hidden="true">R</span><span>{x.r.auto}<span className="note">Reparatie R{x.r.nr}{x.r.klant_naam ? ` · ${x.r.klant_naam}` : ''}</span></span></div></td>
              <td>{x.r.omschrijving}</td>
              <td>{x.wie.length ? x.wie.join(', ') : <span className="note">Nog niemand</span>}</td>
              <td><span className="chip">{REPL[x.r.status]}</span>{x.laat && <span className="chip bad" style={{ marginLeft: 6 }}>te laat</span>}</td>
              <td>{x.r.status === 'wacht' ? <span className="chip warn">onderdelen</span> : <span className="note">—</span>}</td>
              <td className="wp-sinds">{x.sinds ? <>{fmtD(x.sinds)}<span className="note">{daysSince(x.sinds) === 1 ? '1 dag' : `${daysSince(x.sinds)} dagen`}</span></> : '—'}</td>
              {werker && <td className="wp-act" />}
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {form && <TaakForm preset={form} onClose={() => setForm(null)} />}
    </div>
  );
}
