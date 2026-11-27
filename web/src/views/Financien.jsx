import { useState } from 'react';
import { useApp, Empty } from '../ui';
import { carCost, carLabel, eur, fmtD, sum, eigenVoorraad, periodRange, ORDER_ST } from '../lib';
import { PANELEN, KPI_TITELS } from './OverzichtDetail';

// Alle geldzaken op één plek: dezelfde rekensommen als achter de blokken op het dashboard,
// plus wat er nog openstaat (onbetaalde bestellingen, door te belasten aan klanten, geannuleerde aankopen).
const TABS = ['verkocht', 'investering', 'waarde', 'marge', 'consignatie', 'open'];
const ORDL = Object.fromEntries(ORDER_ST);

export default function Financien() {
  const { d, openCar } = useApp();
  const [tab, setTabRaw] = useState(() => { try { return TABS.includes(localStorage.getItem('fin-tab')) ? localStorage.getItem('fin-tab') : 'verkocht'; } catch { return 'verkocht'; } });
  const setTab = (t) => { setTabRaw(t); try { localStorage.setItem('fin-tab', t); } catch { /* geen opslag */ } };

  const eigen = d.autos.filter(eigenVoorraad).map((c) => ({ c, ...carCost(c, d) }));
  const [ja, jb] = periodRange('jaar');
  const verkochtJaar = d.autos.filter((c) => c.status === 'verkocht' && c.verkoopdatum && c.verkoopdatum >= ja && c.verkoopdatum <= jb).map((c) => carCost(c, d));
  const onbetaald = d.bestellingen.filter((b) => b.status !== 'betaald');
  const kpis = [
    ['investering', 'Geïnvesteerd in voorraad', sum(eigen, (r) => r.totaal)],
    ['waarde', 'Vraagprijs voorraad', sum(eigen, (r) => r.prijs)],
    ['marge', 'Verwachte marge', sum(eigen, (r) => r.marge)],
    ['verkocht', `Marge verkocht ${new Date().getFullYear()}`, sum(verkochtJaar, (r) => r.marge)],
    ['open', 'Nog te betalen', sum(onbetaald, (b) => b.bedrag)],
  ];
  const P = PANELEN[tab];

  return (
    <div className="fin">
      <div className="kpis fin-kpis">
        {kpis.map(([k, l, v]) => (
          <button key={k} className={`kpi${tab === k ? ' aan' : ''}`} onClick={() => setTab(k)} aria-pressed={tab === k}>
            <span className="kpi-l">{l}</span><span className="kpi-v num">{eur(v) || '€ 0'}</span>
          </button>
        ))}
      </div>
      <div className="d-tabs" role="tablist" aria-label="Onderdeel">
        {TABS.map((t) => <button key={t} className="d-tab" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'open' ? 'Openstaand' : KPI_TITELS[t]}</button>)}
      </div>
      <div className="pane fin-pane">
        <div className="fin-body">{P ? <P open={openCar} /> : <Openstaand openCar={openCar} />}</div>
      </div>
    </div>
  );
}

function Openstaand({ openCar }) {
  const { d } = useApp();
  const onbetaald = d.bestellingen.filter((b) => b.status !== 'betaald').sort((a, b) => a.datum.localeCompare(b.datum));
  const doorbelasten = d.autos.map((c) => ({ c, k: carCost(c, d) })).filter((x) => x.k.klantFacturen || x.k.klantUren)
    .map((x) => ({ ...x, totaal: x.k.klantFacturen + x.k.klantArbeid }));
  const geannuleerd = d.autos.filter((c) => c.status === 'geannuleerd').map((c) => ({ c, k: carCost(c, d) }));
  const auto = (id) => { const c = d.autoById[id]; return c ? <button className="linkish" onClick={() => openCar(c.id)}>{carLabel(c)}</button> : <span className="note">Los</span>; };
  if (!onbetaald.length && !doorbelasten.length && !geannuleerd.length) return <Empty title="Niets openstaand">Alle bestellingen zijn betaald en er staat niets door te belasten.</Empty>;
  return (
    <div className="stack">
      {onbetaald.length > 0 && <section>
        <h3 className="kp-h">Bestellingen nog niet betaald <span className="note">· {eur(sum(onbetaald, (b) => b.bedrag)) || '€ 0'}</span></h3>
        <div className="tw"><table><thead><tr><th>Datum</th><th>Leverancier</th><th>Omschrijving</th><th>Auto</th><th>Status</th><th className="r">Bedrag</th></tr></thead>
          <tbody>{onbetaald.map((b) => <tr key={b.id}><td>{fmtD(b.datum)}</td><td>{b.leverancier || '—'}</td><td>{b.omschrijving || '—'}</td><td>{auto(b.auto_id)}</td><td>{ORDL[b.status]}</td><td className="r num">{eur(b.bedrag)}</td></tr>)}</tbody>
        </table></div>
      </section>}
      {doorbelasten.length > 0 && <section>
        <h3 className="kp-h">Door te belasten aan klanten <span className="note">· {eur(sum(doorbelasten, (x) => x.totaal)) || '€ 0'}</span></h3>
        <div className="tw"><table><thead><tr><th>Auto</th><th className="r">Facturen</th><th className="r">Uren</th><th className="r">Totaal</th></tr></thead>
          <tbody>{doorbelasten.map((x) => <tr key={x.c.id}><td>{auto(x.c.id)}</td><td className="r num">{eur(x.k.klantFacturen) || '—'}</td><td className="r num">{x.k.klantUren ? `${x.k.klantUren} u · ${eur(x.k.klantArbeid)}` : '—'}</td><td className="r num"><b>{eur(x.totaal)}</b></td></tr>)}</tbody>
        </table></div>
      </section>}
      {geannuleerd.length > 0 && <section>
        <h3 className="kp-h">Geannuleerde aankopen <span className="note">· gemaakte kosten {eur(sum(geannuleerd, (x) => x.k.kosten + x.k.facturen + x.k.arbeid)) || '€ 0'}</span></h3>
        <div className="tw"><table><thead><tr><th>Auto</th><th>Geannuleerd</th><th className="r">Inkoop</th><th className="r">Gemaakte kosten</th></tr></thead>
          <tbody>{geannuleerd.map((x) => <tr key={x.c.id}><td>{auto(x.c.id)}</td><td>{fmtD(x.c.geannuleerd_op) || '—'}</td><td className="r num">{eur(x.k.inkoop) || '—'}</td><td className="r num">{eur(x.k.kosten + x.k.facturen + x.k.arbeid) || '€ 0'}</td></tr>)}</tbody>
        </table></div>
      </section>}
    </div>
  );
}
