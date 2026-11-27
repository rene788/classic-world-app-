import { useState } from 'react';
import { useApp } from '../ui';
import KpiPaneel from './OverzichtDetail';
import { EXTERN_TE_LANG, UITL, carCost, carLabel, carName, daysSince, eur, fmtD, hrs, periodRange, plusDays, sum, today, opVoorraad, isCons } from '../lib';

export default function Overzicht() {
  const { d, go, openCar, openKlant, beheerder, klant, tabs } = useApp();
  const [kpi, setKpi] = useState(null);
  const alle = d.autos.filter(opVoorraad); // alles wat fysiek bij ons staat of onderweg is
  const stock = alle.filter((c) => !isCons(c)); // eigen voorraad
  const cons = alle.filter(isCons);
  const consVerd = sum(cons.map((c) => carCost(c, d)), (x) => x.marge);
  const [ma, mb] = periodRange('maand');
  const cs = stock.map((c) => carCost(c, d));
  const sold = d.autos.filter((c) => c.status === 'verkocht' && (c.verkoopdatum || '') >= ma && (c.verkoopdatum || '') <= mb).map((c) => carCost(c, d)).filter((x) => x.verkocht);
  const onderweg = alle.filter((c) => c.status === 'onderweg');
  const geannuleerd = d.autos.filter((c) => c.status === 'geannuleerd').map((c) => ({ c, k: carCost(c, d) })).sort((a, b) => (b.c.geannuleerd_op || '').localeCompare(a.c.geannuleerd_op || ''));
  const dagen = stock.filter((c) => c.status !== 'onderweg').map((c) => daysSince(c.datum_binnen)).filter((x) => x != null);
  const gem = dagen.length ? Math.round(dagen.reduce((a, b) => a + b, 0) / dagen.length) : null;
  const urenMaand = sum(d.uren.filter((h) => h.datum >= ma && h.datum <= mb), (h) => h.uren);

  // Signalen
  const sig = [];
  const t = today();
  const wacht = d.uren.filter((h) => h.status === 'ingediend').length;
  const laat = d.taken.filter((x) => !x.klaar && x.deadline && x.deadline < t && (!x.auto_id || (d.autoById[x.auto_id] && opVoorraad(d.autoById[x.auto_id]))));
  const vsOpen = d.voorstellen.filter((x) => x.voorstel === 'open').length;
  if (!klant && vsOpen) sig.push({ lvl: 'warn', go: () => go('planning'), t: `${vsOpen} voorstel${vsOpen > 1 ? 'len' : ''} van monteurs wacht${vsOpen > 1 ? 'en' : ''} op akkoord`, s: 'Keur goed of wijs af bij Planning' });
  if (!klant && laat.length) sig.push({ lvl: 'bad', go: () => go('planning'), t: `${laat.length} ta${laat.length > 1 ? 'ken zijn' : 'ak is'} over de datum`, s: 'Bekijk ze bij Planning' });
  if (beheerder && wacht) sig.push({ lvl: 'warn', go: () => go('uren'), t: `${wacht} urenregel${wacht > 1 ? 's wachten' : ' wacht'} op goedkeuring`, s: 'Keur ze goed bij Uren' });
  for (const c of d.autos) {
    if (c.status === 'verkocht') {
      const al = d.afleverlijst.filter((x) => x.auto_id === c.id);
      const dn = al.filter((x) => x.klaar).length;
      if (al.length && dn < al.length) sig.push({ lvl: 'warn', car: c.id, t: `Afleverlijst nog niet af: ${carLabel(c)}`, s: `${dn} van ${al.length} punten gedaan` });
      if (!klant && isCons(c) && !(d.finByAuto[c.id] || {}).cons_afgerekend) sig.push({ lvl: 'bad', car: c.id, t: `Afrekenen met eigenaar: ${carLabel(c)}`, s: 'Consignatie verkocht. Vink "afgerekend" aan in het dossier als het geld is overgemaakt.' });
      continue;
    }
    if (c.status === 'geannuleerd') continue;
    const ct = isCons(c) && (d.finByAuto[c.id] || {}).cons_tot;
    if (!klant && ct && ct <= plusDays(14)) sig.push({ lvl: ct < t ? 'bad' : 'warn', car: c.id, t: `Consignatie ${ct < t ? 'verlopen' : 'loopt af'}: ${carLabel(c)}`, s: `Afspraak tot ${fmtD(ct)}. Verlengen of auto teruggeven?` });
    if (!c.voorraadnr) sig.push({ lvl: 'warn', car: c.id, t: `Geen voorraadnummer: ${carName(c)}`, s: 'Vul voorraad- en chassisnummer in' });
    const dg = c.status === 'onderweg' ? null : daysSince(c.datum_binnen);
    if (!klant && dg != null && dg > 90) sig.push({ lvl: 'bad', car: c.id, t: `${carLabel(c)} staat al ${dg} dagen op voorraad`, s: 'Overweeg prijs of presentatie te herzien' });
    if (c.status === 'werkplaats') {
      const last = d.uren.filter((h) => h.auto_id === c.id).map((h) => h.datum).sort().pop();
      const sd = daysSince(last || c.datum_binnen);
      if (sd != null && sd > 14) sig.push({ lvl: 'warn', car: c.id, t: `Geen uren op ${carLabel(c)} in ${sd} dagen`, s: last ? `Laatste uren op ${fmtD(last)}` : 'Nog nooit uren geschreven' });
    }
  }
  for (const p of d.onderdelen) {
    const c = d.autoById[p.auto_id];
    if (!c || !opVoorraad(c)) continue;
    if (p.status === 'besteld' && p.verwacht && p.verwacht < t) sig.push({ lvl: 'bad', car: c.id, t: `Onderdeel te laat: ${p.onderdeel}`, s: `${carLabel(c)} · verwacht ${fmtD(p.verwacht)}` });
    else if (p.status === 'nodig') sig.push({ lvl: 'info', car: c.id, t: `Nog te bestellen: ${p.onderdeel}`, s: carLabel(c) });
  }
  for (const x of d.contactmomenten) {
    if (!klant && x.afspraak && x.afspraak >= t && x.afspraak <= plusDays(14)) {
      const k = d.klanten.find((y) => y.id === x.klant_id); const c = d.autoById[x.auto_id];
      sig.push({ lvl: 'good', klant: k?.id, car: c?.id, t: `${UITL[x.uitkomst] || 'Afspraak'} op ${fmtD(x.afspraak)}`, s: `${k ? k.naam : 'Klant'}${c ? ' · ' + carLabel(c) : ''}` });
    }
  }
  const om = new Set(d.autos.flatMap((c) => d.matchesForCar(c).filter((m) => !m.informed).map((m) => m.klant.id))).size;
  if (om && !klant) sig.push({ lvl: 'info', go: () => go('matches'), t: `${om} klant${om > 1 ? 'en' : ''} nog te informeren over een passende auto`, s: 'Bekijk de matches' });
  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  sig.sort((a, b) => order[a.lvl] - order[b.lvl]);

  // Locaties: korte samenvatting, de rest staat op het tabblad Locaties
  const opLoc = alle.filter((c) => c.status !== 'onderweg');
  const locTel = d.locaties.filter((l) => l.actief && l.soort !== 'box').map((l) => ({ l, n: opLoc.filter((c) => c.locatie === l.id).length })).filter((x) => x.n || x.l.soort === 'intern');
  const boxLocs = d.locaties.filter((l) => l.actief && l.soort === 'box');
  const boxBezet = boxLocs.filter((l) => opLoc.some((c) => c.locatie === l.id) || d.boxen[l.id]).length;
  const geenLoc = opLoc.filter((c) => !c.locatie).length;
  const teLangExt = opLoc.filter((c) => d.locById[c.locatie]?.soort === 'extern' && daysSince(c.locatie_sinds || c.datum_binnen) > EXTERN_TE_LANG);

  const Kpi = ({ k, l, v, s: sub }) => (
    <button className="kpi" onClick={() => setKpi(k)} aria-haspopup="dialog">
      <span className="kpi-l"><KpiIcoon k={k} />{l}</span><span className="kpi-v num">{v}</span><small>{sub}</small><span className="kpi-m" aria-hidden="true">Bekijk ›</span>
    </button>
  );

  return (
    <div>
      <div className="kpis">
        <Kpi k="voorraad" l="Op voorraad" v={stock.length} s={`${klant ? 'auto\'s' : gem != null ? `gemiddeld ${gem} dagen` : "nog geen auto's"}${onderweg.length ? ` · ${onderweg.length} onderweg` : ''}${cons.length ? ` · + ${cons.length} consignatie` : ''}`} />
 {!klant && <>
        <Kpi k="waarde" l="Voorraadwaarde" v={eur(sum(stock, (c) => d.prijsOf(c))) || '€ 0'} s="som van vraagprijzen" />
        <Kpi k="investering" l="Geïnvesteerd" v={eur(sum(cs, (x) => x.totaal)) || '€ 0'} s="inkoop, kosten, facturen, arbeid" />
        <Kpi k="marge" l="Verwachte marge" v={eur(sum(cs.filter((x) => x.marge != null), (x) => x.marge)) || '€ 0'} s="bruto, op vraagprijzen" />
        <Kpi k="verkocht" l="Marge verkocht deze maand" v={eur(sum(sold, (x) => x.marge)) || '€ 0'} s={`${sold.length} verkocht`} />
        <Kpi k="consignatie" l="Consignatie" v={cons.length} s={cons.length ? `verwacht resultaat ${eur(consVerd) || '€ 0'}` : "geen auto's in consignatie"} />
        </>}
        <Kpi k="uren" l="Werkuren deze maand" v={hrs(urenMaand)} s="alle medewerkers" />
      </div>
      {kpi && <KpiPaneel soort={kpi} onClose={() => setKpi(null)} />}
      <div className="ov">
        <section className="box">
          <h2>Aandacht nodig <span className="count num">{sig.length}</span></h2>
          {!sig.length ? <p className="note">Alles loopt. Niets dat nu aandacht vraagt.</p>
            : sig.slice(0, 40).map((s, i) => (
              <button key={i} className={`sig ${s.lvl}`} onClick={() => (s.go ? s.go() : s.car ? openCar(s.car) : s.klant ? openKlant(s.klant) : null)}>
                <b>{s.t}</b><span>{s.s}</span>
              </button>
            ))}
        </section>
        <section className="box">
          <h2>Locaties {boxLocs.length > 0 && <span className="count num">{boxBezet} van {boxLocs.length} boxen bezet</span>}</h2>
          <div className="loc-sam">
            {locTel.map(({ l, n }) => <span key={l.id}><small>{l.naam}</small><b className="num">{n}{l.plekken ? <em> / {l.plekken}</em> : null}</b></span>)}
            {onderweg.length > 0 && <span><small>Onderweg</small><b className="num">{onderweg.length}</b></span>}
            {geenLoc > 0 && <span className="warn"><small>Geen locatie</small><b className="num">{geenLoc}</b></span>}
          </div>
          {teLangExt.length > 0 && <p className="note" style={{ margin: '8px 0 0' }}><b>{teLangExt.length}</b> auto{teLangExt.length === 1 ? ' staat' : "'s staan"} langer dan {EXTERN_TE_LANG} dagen extern.</p>}
          {tabs.includes('locaties') && <button className="btn" style={{ marginTop: 12 }} onClick={() => go('locaties')}>Naar locaties ›</button>}
          {onderweg.length > 0 && !klant && (
            <div className="ow">
              <h3 className="kp-h">Onderweg: kosten tot nu toe</h3>
              <div className="tw"><table className="ow-t">
                <thead><tr><th>Auto</th><th className="r">Inkoop</th><th className="r mv">Kosten</th><th className="r">Totaal</th></tr></thead>
                <tbody>{onderweg.map((c) => { const k = carCost(c, d); return (
                  <tr key={c.id} className="klik" onClick={() => openCar(c.id)}>
                    <td><button className="linkish" onClick={(e) => { e.stopPropagation(); openCar(c.id); }}>{carLabel(c)}</button>{c.locatie_info && <div className="note">{c.locatie_info}</div>}</td>
                    <td className="r num">{k.cons ? <span className="chip">consignatie</span> : k.inkoop ? eur(k.inkoop) : <span className="chip bad">onbekend</span>}</td>
                    <td className="r num mv">{k.kosten + k.facturen ? eur(k.kosten + k.facturen) : '—'}</td>
                    <td className="r num"><b>{k.totaal ? eur(k.totaal) : '—'}</b></td>
                  </tr>
                ); })}</tbody>
                <tfoot><tr><td>Totaal onderweg · {onderweg.length} auto{onderweg.length === 1 ? '' : "'s"}</td>
                  <td className="r num">{eur(sum(onderweg, (c) => carCost(c, d).inkoop)) || '€ 0'}</td>
                  <td className="r num mv">{eur(sum(onderweg, (c) => { const k = carCost(c, d); return k.kosten + k.facturen; })) || '€ 0'}</td>
                  <td className="r num"><b>{eur(sum(onderweg, (c) => carCost(c, d).totaal)) || '€ 0'}</b></td></tr></tfoot>
              </table></div>
              {onderweg.some((c) => !isCons(c) && !carCost(c, d).inkoop) && <p className="hint">Bij "onbekend" staat nog geen inkoopprijs. Vul die in via Wijzigen in het dossier.</p>}
            </div>
          )}
        </section>
      </div>
      {geannuleerd.length > 0 && !klant && (
        <section className="box" style={{ marginTop: 16 }}>
          <h2>Geannuleerde aankopen <span className="count num">{geannuleerd.length}</span></h2>
          <p className="note" style={{ marginBottom: 10 }}>Deze auto's tellen niet mee in de voorraad. Hier zie je wat er per auto was afgesproken en welke kosten er al gemaakt zijn.</p>
          <div className="tw"><table className="ow-t">
            <thead><tr><th>Auto</th><th className="mv">Geannuleerd op</th><th className="r">Inkoop</th><th className="r">Gemaakte kosten</th></tr></thead>
            <tbody>{geannuleerd.map(({ c, k }) => (
              <tr key={c.id} className="klik" onClick={() => openCar(c.id)}>
                <td><button className="linkish" onClick={(e) => { e.stopPropagation(); openCar(c.id); }}>{carLabel(c)}</button>{c.annuleer_reden && <div className="note">{c.annuleer_reden}</div>}</td>
                <td className="mv">{c.geannuleerd_op ? fmtD(c.geannuleerd_op) : '—'}</td>
                <td className="r num">{k.inkoop ? eur(k.inkoop) : '—'}</td>
                <td className="r num"><b>{k.kosten + k.facturen + k.arbeid ? eur(k.kosten + k.facturen + k.arbeid) : '—'}</b></td>
              </tr>
            ))}</tbody>
            <tfoot><tr><td>Totaal</td><td className="mv" />
              <td className="r num">{eur(sum(geannuleerd, (x) => x.k.inkoop)) || '€ 0'}</td>
              <td className="r num"><b>{eur(sum(geannuleerd, (x) => x.k.kosten + x.k.facturen + x.k.arbeid)) || '€ 0'}</b></td></tr></tfoot>
          </table></div>
          <p className="hint" style={{ marginTop: 6 }}>Gemaakte kosten = transport, facturen en werkplaatsuren die al op de auto stonden. Die ben je mogelijk kwijt.</p>
        </section>
      )}
    </div>
  );
}

const KPI_IC = {
  voorraad: <><path d="M3 15l2-5a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 10l2 5v3h-2.5M5.5 18H3v-3m5.5 3h7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
  waarde: <><path d="M4 7h16v12H4z" /><path d="M4 11h16M8 15h3" /></>,
  investering: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  marge: <><path d="M5 19L19 5" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  verkocht: <><path d="M20 12l-8 8-9-9V3h8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  consignatie: <><path d="M7 11V7a5 5 0 0 1 10 0v4" /><rect x="4" y="11" width="16" height="10" rx="2" /></>,
  uren: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};
function KpiIcoon({ k }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{KPI_IC[k]}</svg>;
}
