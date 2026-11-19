import { useApp } from '../ui';
import { LOCL, UITL, carCost, carLabel, carName, daysSince, eur, fmtD, hrs, periodRange, plusDays, sum, today } from '../lib';

export default function Overzicht() {
  const { d, act, go, openCar, openKlant, beheerder } = useApp();
  const stock = d.autos.filter((c) => c.status !== 'verkocht');
  const [ma, mb] = periodRange('maand');
  const cs = stock.map((c) => carCost(c, d));
  const sold = d.autos.filter((c) => c.status === 'verkocht' && (c.verkoopdatum || '') >= ma && (c.verkoopdatum || '') <= mb).map((c) => carCost(c, d)).filter((x) => x.verkocht);
  const onderweg = stock.filter((c) => c.status === 'onderweg');
  const dagen = stock.filter((c) => c.status !== 'onderweg').map((c) => daysSince(c.datum_binnen)).filter((x) => x != null);
  const gem = dagen.length ? Math.round(dagen.reduce((a, b) => a + b, 0) / dagen.length) : null;
  const urenMaand = sum(d.uren.filter((h) => h.datum >= ma && h.datum <= mb), (h) => h.uren);

  // Signalen
  const sig = [];
  const t = today();
  const wacht = d.uren.filter((h) => h.status === 'ingediend').length;
  if (beheerder && wacht) sig.push({ lvl: 'warn', go: () => go('uren'), t: `${wacht} urenregel${wacht > 1 ? 's wachten' : ' wacht'} op goedkeuring`, s: 'Keur ze goed bij Uren' });
  for (const c of d.autos) {
    if (c.status === 'verkocht') {
      const al = d.afleverlijst.filter((x) => x.auto_id === c.id);
      const dn = al.filter((x) => x.klaar).length;
      if (al.length && dn < al.length) sig.push({ lvl: 'warn', car: c.id, t: `Afleverlijst nog niet af: ${carLabel(c)}`, s: `${dn} van ${al.length} punten gedaan` });
      continue;
    }
    if (!c.voorraadnr) sig.push({ lvl: 'warn', car: c.id, t: `Geen voorraadnummer: ${carName(c)}`, s: 'Vul voorraad- en chassisnummer in' });
    const dg = c.status === 'onderweg' ? null : daysSince(c.datum_binnen);
    if (dg != null && dg > 90) sig.push({ lvl: 'bad', car: c.id, t: `${carLabel(c)} staat al ${dg} dagen op voorraad`, s: 'Overweeg prijs of presentatie te herzien' });
    if (c.status === 'werkplaats') {
      const last = d.uren.filter((h) => h.auto_id === c.id).map((h) => h.datum).sort().pop();
      const sd = daysSince(last || c.datum_binnen);
      if (sd != null && sd > 14) sig.push({ lvl: 'warn', car: c.id, t: `Geen uren op ${carLabel(c)} in ${sd} dagen`, s: last ? `Laatste uren op ${fmtD(last)}` : 'Nog nooit uren geschreven' });
    }
  }
  for (const p of d.onderdelen) {
    const c = d.autoById[p.auto_id];
    if (!c || c.status === 'verkocht') continue;
    if (p.status === 'besteld' && p.verwacht && p.verwacht < t) sig.push({ lvl: 'bad', car: c.id, t: `Onderdeel te laat: ${p.onderdeel}`, s: `${carLabel(c)} · verwacht ${fmtD(p.verwacht)}` });
    else if (p.status === 'nodig') sig.push({ lvl: 'info', car: c.id, t: `Nog te bestellen: ${p.onderdeel}`, s: carLabel(c) });
  }
  for (const x of d.contactmomenten) {
    if (x.afspraak && x.afspraak >= t && x.afspraak <= plusDays(14)) {
      const k = d.klanten.find((y) => y.id === x.klant_id); const c = d.autoById[x.auto_id];
      sig.push({ lvl: 'good', klant: k?.id, car: c?.id, t: `${UITL[x.uitkomst] || 'Afspraak'} op ${fmtD(x.afspraak)}`, s: `${k ? k.naam : 'Klant'}${c ? ' · ' + carLabel(c) : ''}` });
    }
  }
  const om = new Set(d.autos.flatMap((c) => d.matchesForCar(c).filter((m) => !m.informed).map((m) => m.klant.id))).size;
  if (om) sig.push({ lvl: 'info', go: () => go('matches'), t: `${om} klant${om > 1 ? 'en' : ''} nog te informeren over een passende auto`, s: 'Bekijk de matches' });
  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  sig.sort((a, b) => order[a.lvl] - order[b.lvl]);

  const at = (k) => stock.filter((c) => c.locatie === k);
  const nVol = Array.from({ length: 10 }, (_, i) => d.boxen['box' + (i + 1)]).filter(Boolean).length;
  const vol = (k, v) => act((db) => db.upsert('boxen', { locatie: k, vol: v }), null, ['boxen']);
  const short = (c) => (c.voorraadnr ? '#' + c.voorraadnr + ' ' + (c.merk || '') : carName(c));
  const Box = ({ k, label }) => {
    const cars = at(k);
    return (
      <div className={`gbox${cars.length ? ' has' : ''}${d.boxen[k] ? ' vol' : ''}`}>
        <div className="gbox-h"><small>{label}</small>
          <label className="volchk"><input type="checkbox" checked={!!d.boxen[k]} onChange={(e) => vol(k, e.target.checked)} />vol</label></div>
        {cars.length ? cars.map((c) => <button key={c.id} className="linkish" title={carLabel(c)} onClick={() => openCar(c.id)}>{short(c)}</button>) : <span className="leeg">leeg</span>}
      </div>
    );
  };

  return (
    <div>
      <dl className="kpis">
        <div className="kpi"><dt>Op voorraad</dt><dd className="num">{stock.length}</dd><small>{gem != null ? `gemiddeld ${gem} dagen` : "nog geen auto's"}{onderweg.length ? ` · ${onderweg.length} onderweg` : ''}</small></div>
        <div className="kpi"><dt>Voorraadwaarde</dt><dd className="num">{eur(sum(stock, (c) => d.prijsOf(c))) || '€ 0'}</dd><small>som van vraagprijzen</small></div>
        <div className="kpi"><dt>Geïnvesteerd</dt><dd className="num">{eur(sum(cs, (x) => x.totaal)) || '€ 0'}</dd><small>inkoop, kosten, facturen, arbeid</small></div>
        <div className="kpi"><dt>Verwachte marge</dt><dd className="num">{eur(sum(cs.filter((x) => x.marge != null), (x) => x.marge)) || '€ 0'}</dd><small>bruto, op vraagprijzen</small></div>
        <div className="kpi"><dt>Marge verkocht deze maand</dt><dd className="num">{eur(sum(sold, (x) => x.marge)) || '€ 0'}</dd><small>{sold.length} verkocht</small></div>
        <div className="kpi"><dt>Werkuren deze maand</dt><dd className="num">{hrs(urenMaand)}</dd><small>alle medewerkers</small></div>
      </dl>
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
          <h2>Locaties <span className="count num">{nVol} van 10 boxen vol</span></h2>
          <div className="legend" style={{ marginBottom: 12 }}>
            {['werkplaats', 'showroom', 'loods', 'extern'].map((k) => <span key={k}>{LOCL[k]} <b className="num">{at(k).length}</b></span>)}
            {onderweg.length > 0 && <span>Onderweg <b className="num">{onderweg.length}</b></span>}
            {stock.filter((c) => !c.locatie && c.status !== 'onderweg').length > 0 && <span>Onbekend <b className="num">{stock.filter((c) => !c.locatie && c.status !== 'onderweg').length}</b></span>}
          </div>
          <div style={{ marginBottom: 8 }}><Box k="loods" label="Externe loods" /></div>
          <div className="boxes">{Array.from({ length: 10 }, (_, i) => <Box key={i} k={'box' + (i + 1)} label={'Box ' + (i + 1)} />)}</div>
          {at('extern').length > 0 && <div style={{ marginTop: 12 }}>{at('extern').map((c) => (
            <div key={c.id} className="doc"><span className="loc">Extern</span><button className="linkish" onClick={() => openCar(c.id)}>{carLabel(c)}</button><span className="note">{c.locatie_info || 'plek niet ingevuld'}</span></div>
          ))}</div>}
          {onderweg.length > 0 && <div style={{ marginTop: 12 }}>{onderweg.map((c) => (
            <div key={c.id} className="doc"><span className="pill st-onderweg">Onderweg</span><button className="linkish" onClick={() => openCar(c.id)}>{carLabel(c)}</button>{c.locatie_info && <span className="note">{c.locatie_info}</span>}</div>
          ))}</div>}
          <p className="hint" style={{ marginTop: 8 }}>Er passen meerdere auto's in een box. Vink "vol" aan zodra er niets meer bij kan.</p>
        </section>
      </div>
    </div>
  );
}
