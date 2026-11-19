import { useState } from 'react';
import { useApp, Sel, DelBtn, Empty } from '../ui';
import { carLabel, elapsed, fmtD, hrs, sum, periodRange } from '../lib';
import { UrenForm } from './MijnWerk';

const PERIODES = [['week', 'Deze week'], ['vorigeweek', 'Vorige week'], ['maand', 'Deze maand'], ['vorigemaand', 'Vorige maand'], ['alles', 'Alles']];

export default function Uren() {
  const { d, act, geld, beheerder, uid, openCar } = useApp();
  const [periode, setPeriode] = useState(geld ? 'maand' : 'week');
  const [mon, setMon] = useState('');
  const [st, setSt] = useState(beheerder && d.uren.some((h) => h.status === 'ingediend') ? 'ingediend' : '');
  const [edit, setEdit] = useState(null);
  const [nieuw, setNieuw] = useState(false);
  const [a, b] = periodRange(periode);

  const list = d.uren
    .filter((h) => (st === 'ingediend' ? true : h.datum >= a && h.datum <= b))
    .filter((h) => !mon || h.monteur_id === mon)
    .filter((h) => !st || h.status === st)
    .filter((h) => geld || h.monteur_id === uid)
    .sort((x, y) => y.datum.localeCompare(x.datum) || (y.aangemaakt || '').localeCompare(x.aangemaakt || ''));

  const mensen = [...new Set(d.uren.map((h) => h.monteur_id))].map((id) => [id, d.names[id] || 'Onbekend']).sort((x, y) => x[1].localeCompare(y[1], 'nl'));
  const perPersoon = mensen.map(([id, n]) => [n, sum(list.filter((h) => h.monteur_id === id), (h) => h.uren)]).filter(([, t]) => t > 0);
  const teKeuren = list.filter((h) => h.status === 'ingediend');

  const keur = (ids) => act(async (db) => { for (const id of ids) await db.update('uren', id, { status: 'goedgekeurd' }); }, ids.length > 1 ? `${ids.length} regels goedgekeurd` : 'Goedgekeurd', ['uren']);

  return (
    <div>
      {geld && d.klokken.length > 0 && (
        <div className="banner">
          <b>Nu aan het werk: </b>
          {d.klokken.map((k) => `${d.names[k.monteur_id] || 'Iemand'} (${elapsed(k.gestart_op)}${d.autoById[k.auto_id] ? ' · ' + carLabel(d.autoById[k.auto_id]) : ''})`).join(', ')}
        </div>
      )}
      <div className="filters">
        {st !== 'ingediend' && <Sel value={periode} onChange={setPeriode} options={PERIODES} aria-label="Periode" />}
        {geld && <Sel value={mon} onChange={setMon} options={mensen} empty="Alle medewerkers" aria-label="Medewerker" />}
        <Sel value={st} onChange={setSt} options={[['ingediend', 'Wacht op goedkeuring'], ['goedgekeurd', 'Goedgekeurd']]} empty="Alle uren" aria-label="Status" />
        <button className="btn" onClick={() => setNieuw(true)}>+ Uren</button>
        {beheerder && teKeuren.length > 1 && <button className="btn primary" onClick={() => keur(teKeuren.map((h) => h.id))}>Alle {teKeuren.length} goedkeuren</button>}
      </div>
      <div className="totals">
        <dl className="tot"><dt>Totaal</dt><dd className="num">{hrs(sum(list, (h) => h.uren))} u</dd></dl>
        {geld && <dl className="tot"><dt>Voor klanten</dt><dd className="num">{hrs(sum(list.filter((h) => h.voor_klant), (h) => h.uren))} u</dd></dl>}
        {geld && perPersoon.map(([n, t]) => <dl key={n} className="tot"><dt>{n}</dt><dd className="num">{hrs(t)} u</dd></dl>)}
      </div>
      {!list.length ? <div className="pane"><Empty title="Geen uren">{st === 'ingediend' ? 'Er wacht niets op goedkeuring.' : 'Geen uren in deze periode.'}</Empty></div> : (
        <div className="tw"><table>
          <thead><tr><th>Datum</th>{geld && <th>Medewerker</th>}<th>Auto</th><th className="r">Uren</th><th>Wat</th><th>Status</th>{beheerder && <th />}</tr></thead>
          <tbody>{list.map((h) => {
            const c = d.autoById[h.auto_id];
            return (
              <tr key={h.id}>
                <td>{fmtD(h.datum)}</td>
                {geld && <td>{d.names[h.monteur_id] || '—'}</td>}
                <td>{c ? <button className="linkish" onClick={() => openCar(c.id)}>{carLabel(c)}</button> : <span className="note">Algemeen</span>}</td>
                <td className="r num">{hrs(h.uren)}</td>
                <td>{h.omschrijving || '—'}{h.voor_klant && <span className="chip match" style={{ marginLeft: 6 }}>voor klant</span>}</td>
                <td>{h.status === 'goedgekeurd' ? <span className="chip ok">Goedgekeurd</span> : <span className="chip">Wacht</span>}</td>
                {beheerder && <td className="r" style={{ whiteSpace: 'nowrap' }}>
                  {h.status === 'ingediend' && <button className="btn sm ok" onClick={() => keur([h.id])}>Goedkeuren</button>}{' '}
                  <button className="btn sm" onClick={() => setEdit(h)}>Wijzigen</button>{' '}
                  <DelBtn x onConfirm={() => act((db) => db.remove('uren', h.id), 'Verwijderd', ['uren'])} />
                </td>}
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      {!geld && <p className="hint" style={{ marginTop: 8 }}>Gemelde uren kun je niet zelf wijzigen. Klopt er iets niet? Vraag de beheerder.</p>}
      {edit && <UrenForm edit={edit} onClose={() => setEdit(null)} />}
      {nieuw && <UrenForm onClose={() => setNieuw(false)} />}
    </div>
  );
}
