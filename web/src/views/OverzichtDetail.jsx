import { useState } from 'react';
import { useApp, Modal, Sel, Status, Loc, useUrls, CarFoto } from '../ui';
import { STATUSES, carCost, carName, daysSince, eur, fmtD, hrs, periodRange, sum, AFGESLOTEN, eigenVoorraad, isCons, opVoorraad } from '../lib';

// Uitklappanelen achter de getallen op het overzicht.
// Elk paneel: bovenin een korte uitsplitsing, daaronder een sorteerbare lijst. Klik op een auto = dossier.

export const KPI_TITELS = {
  voorraad: 'Op voorraad',
  waarde: 'Voorraadwaarde',
  investering: 'Geïnvesteerd',
  marge: 'Verwachte marge',
  verkocht: 'Marge verkocht',
  consignatie: 'Consignatie',
  uren: 'Werkuren',
};

const PERIODES = [['maand', 'Deze maand'], ['vorigemaand', 'Vorige maand'], ['kwartaal', 'Dit kwartaal'], ['jaar', 'Dit jaar']];
const pct = (n) => (n == null || !isFinite(n) ? '' : `${Math.round(n * 100)}%`);

export default function KpiPaneel({ soort, onClose }) {
  const { openCar } = useApp();
  const open = (id) => { onClose(); openCar(id); };
  const P = { voorraad: Voorraad, waarde: Waarde, investering: Investering, marge: Marge, verkocht: Verkocht, uren: Uren, consignatie: Consignatie }[soort];
  return (
    <Modal title={KPI_TITELS[soort]} onClose={onClose} wide sheet>
      <P open={open} />
    </Modal>
  );
}

// ---------- bouwstenen ----------

function Verdeling({ items, fmt = (v) => v, totaal }) {
  const t = totaal ?? sum(items, (x) => Math.max(0, x.v));
  return (
    <div className="verdeling">
      {items.map((x) => (
        <div key={x.k} className="vd-r">
          <span className="vd-l">{x.k}</span>
          <span className="bar"><i style={{ width: `${t ? Math.max(2, (Math.max(0, x.v) / t) * 100) : 0}%`, background: x.kleur }} /></span>
          <b className="num">{fmt(x.v)}</b>
        </div>
      ))}
    </div>
  );
}

const perMerk = (cars, waarde = () => 1, max = 7) => {
  const m = {};
  for (const c of cars) { const k = c.merk || 'Onbekend'; m[k] = (m[k] || 0) + waarde(c); }
  const rij = Object.entries(m).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  if (rij.length <= max) return rij;
  return [...rij.slice(0, max - 1), { k: 'Overige merken', v: sum(rij.slice(max - 1), (x) => x.v) }];
};

// Rekensom: regels met bedragen en een totaalregel, zoals op een afrekening
function Rekensom({ regels, totaal }) {
  return (
    <table className="som">
      <tbody>
        {regels.map((r) => (
          <tr key={r.l} className={r.sub ? 'sub' : undefined}>
            <td>{r.op ? <span className="som-op">{r.op}</span> : null}{r.l}{r.n != null && <span className="note"> · {r.n} auto{r.n === 1 ? '' : "'s"}</span>}{r.uitleg && <span className="note"> · {r.uitleg}</span>}</td>
            <td className="r num">{geld(r.v)}</td>
          </tr>
        ))}
        <tr className="som-t"><td>{totaal.l}{totaal.uitleg && <span className="note"> · {totaal.uitleg}</span>}</td><td className={`r num${totaal.v < 0 ? ' neg' : ''}`}>{geld(totaal.v)}</td></tr>
      </tbody>
    </table>
  );
}

// Lijst per auto, standaard ingeklapt zodat het overzicht van de bedragen voorop staat
function PerAuto({ n, children }) {
  const [open, setOpen] = useState(false);
  if (!n) return null;
  return (
    <div className="perauto">
      <button className="btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'Verberg' : 'Toon'} per auto ({n})</button>
      {open && children}
    </div>
  );
}

const perStatusGeld = (rows, waarde) => STATUSES.filter(([k]) => !AFGESLOTEN.includes(k))
  .map(([k, l]) => { const rs = rows.filter((r) => (r.c.status || 'binnen') === k); return { l, n: rs.length, v: sum(rs, waarde) }; })
  .filter((x) => x.n);

// Sorteerbare tabel met auto's. kolommen: [{ k, l, v(row), toon(row), r (rechts uitlijnen) }]
function AutoTabel({ rows, kolommen, start, open, leeg = 'Geen auto\'s.' }) {
  const [srt, setSrt] = useState(start);
  const urls = useUrls(rows.map((r) => r.c?.foto));
  const kol = kolommen.find((k) => k.k === srt.k) || kolommen[0];
  const sorted = [...rows].sort((a, b) => {
    const x = kol.v(a), y = kol.v(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1; if (y == null) return -1; // leeg altijd onderaan
    const r = typeof x === 'string' ? x.localeCompare(y, 'nl', { numeric: true }) : x - y;
    return srt.dir === 'asc' ? r : -r;
  });
  const klik = (k) => setSrt((s) => (s.k === k ? { k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { k, dir: kolommen.find((x) => x.k === k).r ? 'desc' : 'asc' }));
  if (!rows.length) return <p className="note">{leeg}</p>;
  return (
    <div className="tw"><table className="kt">
      <thead><tr>
        <th aria-label="Foto" />
        {kolommen.map((k) => (
          <th key={k.k} className={[k.r && 'r', k.mv && 'mv'].filter(Boolean).join(' ') || undefined} aria-sort={srt.k === k.k ? (srt.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
            <button className="th-s" onClick={() => klik(k.k)}>{k.l}{srt.k === k.k ? (srt.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
          </th>
        ))}
      </tr></thead>
      <tbody>{sorted.map((r, i) => (
        <tr key={r.c?.id || r.key || i} className={r.c ? 'klik' : undefined} onClick={r.c ? () => open(r.c.id) : undefined}>
          <td className="kt-f">{r.c ? <CarFoto c={r.c} url={urls[r.c.foto]} sm /> : null}</td>
          {kolommen.map((k) => <td key={k.k} className={[k.r && 'r num', k.mv && 'mv'].filter(Boolean).join(' ') || undefined}>{k.toon ? k.toon(r) : k.v(r) ?? '—'}</td>)}
        </tr>
      ))}</tbody>
    </table></div>
  );
}

const autoKol = { k: 'auto', l: 'Auto', v: (r) => r.c.voorraadnr || carName(r.c),
  toon: (r) => <span className="kt-a"><b>{carName(r.c)}{r.c.bouwjaar ? <span className="note"> · {r.c.bouwjaar}</span> : null}</b>{r.c.voorraadnr && <span className="note mono">#{r.c.voorraadnr}</span>}<span className="mo"><Status s={r.c.status} c={r.c} /></span></span> };
const geld = (n) => (n == null ? '—' : eur(n) || '€ 0');

// ---------- de zes panelen ----------

function Voorraad({ open }) {
  const { d, klant } = useApp();
  const stock = d.autos.filter(eigenVoorraad);
  const perStatus = STATUSES.filter(([k]) => !AFGESLOTEN.includes(k)).map(([k, l]) => ({ k: l, v: stock.filter((c) => (c.status || 'binnen') === k).length, kleur: `var(--st-${k})` }));
  const zonderDatum = stock.filter((c) => c.status !== 'onderweg' && !c.datum_binnen).length;
  return (
    <>
      <div className="kp-top">
        <div><h3>Per status</h3><Verdeling items={perStatus} /></div>
        <div><h3>Per merk</h3><Verdeling items={perMerk(stock)} /></div>
      </div>
      {zonderDatum > 0 && !klant && <div className="banner warn">{zonderDatum} auto's hebben geen datum van binnenkomst. Die staan onderaan bij "Dagen". Vul de datum in via Wijzigen in het dossier.</div>}
      <AutoTabel open={open} start={klant ? { k: 'auto', dir: 'asc' } : { k: 'dagen', dir: 'desc' }}
        rows={stock.map((c) => ({ c, dagen: c.status === 'onderweg' ? null : daysSince(c.datum_binnen) }))}
        kolommen={[autoKol,
          { k: 'status', l: 'Status', mv: true, v: (r) => r.c.status, toon: (r) => <Status s={r.c.status} c={r.c} /> },
          { k: 'loc', l: 'Locatie', mv: true, v: (r) => r.c.locatie || null, toon: (r) => <Loc c={r.c} /> },
          !klant && { k: 'dagen', l: 'Dagen', r: true, v: (r) => r.dagen, toon: (r) => (r.dagen == null ? '—' : <span className={r.dagen > 90 ? 'chip bad' : undefined}>{r.dagen}</span>) },
        ].filter(Boolean)} />
    </>
  );
}

function Waarde({ open }) {
  const { d } = useApp();
  const stock = d.autos.filter(eigenVoorraad);
  const [alleenZonder, setAZ] = useState(false);
  const zonder = stock.filter((c) => d.prijsOf(c) == null);
  const metPrijs = stock.filter((c) => d.prijsOf(c) != null).map((c) => ({ c, p: d.prijsOf(c) }));
  const rows = alleenZonder ? zonder.map((c) => ({ c, p: null })) : stock.map((c) => ({ c, p: d.prijsOf(c) }));
  return (
    <>
      <Rekensom regels={perStatusGeld(metPrijs, (r) => r.p)}
        totaal={{ l: 'Totaal voorraadwaarde', v: sum(metPrijs, (r) => r.p), uitleg: `som van ${metPrijs.length} vraagprijzen` }} />
      {zonder.length > 0 && (
        <div className="banner warn kp-ban">
          <span><b>{zonder.length} auto's hebben geen vraagprijs</b> en tellen hierboven niet mee.</span>
          <button className="btn sm" onClick={() => setAZ((v) => !v)}>{alleenZonder ? 'Toon alle auto\'s' : 'Toon alleen deze'}</button>
        </div>
      )}
      <PerAuto n={rows.length}>
        <AutoTabel open={open} rows={rows} start={{ k: 'p', dir: 'desc' }}
          kolommen={[autoKol,
            { k: 'status', l: 'Status', mv: true, v: (r) => r.c.status, toon: (r) => <Status s={r.c.status} c={r.c} /> },
            { k: 'p', l: 'Vraagprijs', r: true, v: (r) => r.p, toon: (r) => (r.p == null ? <span className="chip bad">geen prijs</span> : eur(r.p)) },
          ]} />
      </PerAuto>
    </>
  );
}

function Investering({ open }) {
  const { d } = useApp();
  const rows = d.autos.filter(eigenVoorraad).map((c) => ({ c, ...carCost(c, d) }));
  const t = (k) => sum(rows, (r) => r[k]);
  const tarief = rows[0]?.tarief || Number(d.settings.uurtarief) || 0;
  const geenInkoop = rows.filter((r) => !r.inkoop).length;
  return (
    <>
      <Rekensom
        regels={[
          { l: 'Inkoop', v: t('inkoop'), n: rows.length - geenInkoop },
          { op: '+', l: 'Kosten (transport, keuring e.d.)', v: t('kosten') },
          { op: '+', l: 'Facturen onderdelen en werk derden', v: t('facturen') },
          { op: '+', l: 'Arbeid eigen werkplaats', v: t('arbeid'), uitleg: tarief ? `${hrs(t('uren'))} uur à ${eur(tarief)}` : 'uurtarief nog niet ingevuld bij Beheer' },
        ]}
        totaal={{ l: 'Totaal geïnvesteerd in voorraad', v: t('totaal') }} />
      <div><h3 className="kp-h">Verdeeld over de voorraad</h3>
        <Rekensom regels={perStatusGeld(rows, (r) => r.totaal)} totaal={{ l: 'Totaal', v: t('totaal') }} /></div>
      {geenInkoop > 0 && <div className="banner warn">{geenInkoop} auto{geenInkoop === 1 ? ' heeft' : "'s hebben"} geen inkoopprijs en tellen voor € 0 mee.</div>}
      <PerAuto n={rows.length}>
        <AutoTabel open={open} rows={rows} start={{ k: 'totaal', dir: 'desc' }}
          kolommen={[autoKol,
            { k: 'inkoop', l: 'Inkoop', r: true, v: (r) => r.inkoop || null, toon: (r) => geld(r.inkoop || null) },
            { k: 'kosten', l: 'Kosten', r: true, mv: true, v: (r) => r.kosten, toon: (r) => (r.kosten ? eur(r.kosten) : '—') },
            { k: 'facturen', l: 'Facturen', r: true, mv: true, v: (r) => r.facturen, toon: (r) => (r.facturen ? eur(r.facturen) : '—') },
            { k: 'arbeid', l: 'Arbeid', r: true, mv: true, v: (r) => r.arbeid, toon: (r) => (r.arbeid ? eur(r.arbeid) : '—') },
            { k: 'totaal', l: 'Totaal', r: true, v: (r) => r.totaal || null, toon: (r) => <b>{geld(r.totaal || null)}</b> },
          ]} />
      </PerAuto>
    </>
  );
}

function Marge({ open }) {
  const { d } = useApp();
  const alle = d.autos.filter(eigenVoorraad).map((c) => ({ c, ...carCost(c, d) }));
  const rows = alle.filter((r) => r.marge != null).map((r) => ({ ...r, pct: r.prijs ? r.marge / r.prijs : null }));
  const omzet = sum(rows, (r) => r.prijs), kost = sum(rows, (r) => r.totaal), marge = sum(rows, (r) => r.marge), btw = sum(rows, (r) => r.btw);
  const neg = rows.filter((r) => r.marge < 0).length;
  return (
    <>
      <Rekensom
        regels={[
          { l: 'Vraagprijzen', v: omzet, n: rows.length },
          { op: '−', l: 'Geïnvesteerd in deze auto\'s', v: kost },
        ]}
        totaal={{ l: 'Verwachte marge (bruto)', v: marge, uitleg: omzet ? `${pct(marge / omzet)} van de vraagprijs` : null }} />
      <Rekensom
        regels={[{ l: 'Verwachte marge (bruto)', v: marge }, { op: '−', l: 'Btw over de marge (margeregeling, 21/121)', v: btw }]}
        totaal={{ l: 'Verwachte marge na btw', v: marge - btw }} />
      {alle.length > rows.length && <p className="hint">{alle.length - rows.length} auto's zonder vraagprijs tellen niet mee.</p>}
      {neg > 0 && <div className="banner warn">{neg} auto{neg === 1 ? ' heeft' : "'s hebben"} een negatieve marge: de vraagprijs is lager dan wat erin zit.</div>}
      <PerAuto n={rows.length}>
        <AutoTabel open={open} rows={rows} start={{ k: 'pct', dir: 'asc' }}
          kolommen={[autoKol,
            { k: 'prijs', l: 'Vraagprijs', r: true, v: (r) => r.prijs, toon: (r) => eur(r.prijs) },
            { k: 'totaal', l: 'Geïnvesteerd', r: true, mv: true, v: (r) => r.totaal, toon: (r) => eur(r.totaal) },
            { k: 'marge', l: 'Marge', r: true, v: (r) => r.marge, toon: (r) => <b className={r.marge < 0 ? 'neg' : undefined}>{eur(r.marge)}</b> },
            { k: 'pct', l: '%', r: true, v: (r) => r.pct, toon: (r) => <span className={r.marge < 0 ? 'chip bad' : r.pct < 0.1 ? 'chip warn' : undefined}>{pct(r.pct)}</span> },
          ]} />
      </PerAuto>
    </>
  );
}

function Verkocht({ open }) {
  const { d } = useApp();
  const [per, setPer] = useState('maand');
  const [a, b] = periodRange(per);
  const alleVerkocht = d.autos.filter((c) => c.status === 'verkocht');
  const rows = alleVerkocht.filter((c) => c.verkoopdatum && c.verkoopdatum >= a && c.verkoopdatum <= b).map((c) => ({ c, ...carCost(c, d) }));
  const metPrijs = rows.filter((r) => r.verkocht);
  const omzet = sum(metPrijs, (r) => r.prijs), kost = sum(metPrijs, (r) => r.totaal), marge = sum(metPrijs, (r) => r.marge), btw = sum(metPrijs, (r) => r.btw);
  const zonderDatum = alleVerkocht.filter((c) => !c.verkoopdatum).length;
  return (
    <>
      <div className="kp-bar"><Sel value={per} onChange={setPer} options={PERIODES} aria-label="Periode" /><span className="note">{fmtD(a)} t/m {fmtD(b)}</span></div>
      <Rekensom
        regels={[
          { l: 'Verkoopopbrengst', v: omzet, n: metPrijs.length },
          { op: '−', l: 'Geïnvesteerd in deze auto\'s', v: kost },
          { op: '=', l: 'Marge (bruto)', v: marge, sub: true },
          { op: '−', l: 'Btw over de marge (margeregeling)', v: btw },
        ]}
        totaal={{ l: 'Marge na btw', v: marge - btw }} />
      {rows.length > metPrijs.length && <div className="banner warn">{rows.length - metPrijs.length} verkochte auto{rows.length - metPrijs.length === 1 ? ' heeft' : "'s hebben"} geen verkoopprijs en {rows.length - metPrijs.length === 1 ? 'telt' : 'tellen'} niet mee. Vul die in bij Financiën in het dossier.</div>}
      {zonderDatum > 0 && <p className="hint">{zonderDatum} verkochte auto's uit het archief hebben geen verkoopdatum en vallen buiten elke periode.</p>}
      <PerAuto n={rows.length}>
        <AutoTabel open={open} rows={rows} start={{ k: 'datum', dir: 'desc' }}
          kolommen={[autoKol,
            { k: 'datum', l: 'Verkocht op', mv: true, v: (r) => r.c.verkoopdatum, toon: (r) => fmtD(r.c.verkoopdatum) },
            { k: 'prijs', l: 'Verkoopprijs', r: true, v: (r) => (r.verkocht ? r.prijs : null), toon: (r) => (r.verkocht ? eur(r.prijs) : '—') },
            { k: 'totaal', l: 'Geïnvesteerd', r: true, mv: true, v: (r) => r.totaal || null, toon: (r) => geld(r.totaal || null) },
            { k: 'marge', l: 'Marge', r: true, v: (r) => (r.verkocht ? r.marge : null), toon: (r) => (r.verkocht ? <b className={r.marge < 0 ? 'neg' : undefined}>{eur(r.marge)}</b> : '—') },
          ]} />
      </PerAuto>
      {!rows.length && <p className="note">Geen verkochte auto's in deze periode.</p>}
    </>
  );
}

function Uren({ open }) {
  const { d } = useApp();
  const [per, setPer] = useState('maand');
  const [a, b] = periodRange(per);
  const hs = d.uren.filter((h) => h.datum >= a && h.datum <= b);
  const pm = {};
  for (const h of hs) { const n = d.names[h.monteur_id] || 'Onbekend'; pm[n] = (pm[n] || 0) + Number(h.uren || 0); }
  const perMonteur = Object.entries(pm).map(([k, v]) => ({ k, v })).sort((x, y) => y.v - x.v);
  const pa = {};
  for (const h of hs) {
    const k = h.auto_id || '-';
    pa[k] = pa[k] || { uren: 0, wie: new Set(), wacht: 0 };
    pa[k].uren += Number(h.uren || 0); pa[k].wie.add(d.names[h.monteur_id] || 'Onbekend');
    if (h.status !== 'goedgekeurd') pa[k].wacht += Number(h.uren || 0);
  }
  const rows = Object.entries(pa).filter(([k]) => d.autoById[k]).map(([k, x]) => ({ c: d.autoById[k], ...x, wie: [...x.wie].join(', ') }));
  const los = pa['-'] || Object.entries(pa).filter(([k]) => k !== '-' && !d.autoById[k]).reduce((s, [, x]) => ({ uren: s.uren + x.uren }), { uren: 0 });
  const wacht = sum(hs.filter((h) => h.status !== 'goedgekeurd'), (h) => h.uren);
  return (
    <>
      <div className="kp-bar"><Sel value={per} onChange={setPer} options={PERIODES} aria-label="Periode" /><span className="note">{fmtD(a)} t/m {fmtD(b)}</span></div>
      <div className="kp-top">
        <div><h3>Totaal</h3><p className="kp-big num">{hrs(sum(hs, (h) => h.uren))} uur</p>
          <p className="note">{wacht ? `${hrs(wacht)} uur wacht nog op goedkeuring` : 'Alles goedgekeurd'}{los.uren ? ` · ${hrs(los.uren)} uur niet aan een auto` : ''}</p></div>
        <div><h3>Per monteur</h3>{perMonteur.length ? <Verdeling items={perMonteur} fmt={(v) => `${hrs(v)} u`} /> : <p className="note">Geen uren in deze periode.</p>}</div>
      </div>
      <AutoTabel open={open} rows={rows} start={{ k: 'uren', dir: 'desc' }} leeg="Geen uren op auto's in deze periode."
        kolommen={[autoKol,
          { k: 'wie', l: 'Monteurs', mv: true, v: (r) => r.wie },
          { k: 'uren', l: 'Uren', r: true, v: (r) => r.uren, toon: (r) => <>{hrs(r.uren)}{r.wacht ? <span className="note"> ({hrs(r.wacht)} open)</span> : null}</> },
        ]} />
    </>
  );
}

function Consignatie({ open }) {
  const { d } = useApp();
  const rows = d.autos.filter((c) => opVoorraad(c) && isCons(c)).map((c) => {
    const k = carCost(c, d);
    const eig = d.klanten.find((x) => x.id === k.f.cons_eigenaar);
    return { c, ...k, eig };
  });
  const metAfspraak = rows.filter((r) => r.verdienste != null);
  const t = (k, rs = metAfspraak) => sum(rs, (r) => r[k]);
  const zonder = rows.length - metAfspraak.length;
  const afspraakTekst = (r) => (!r.f.cons_afspraak || r.f.cons_waarde == null ? null
    : r.f.cons_afspraak === 'provisie_pct' ? `${r.f.cons_waarde}% provisie` : r.f.cons_afspraak === 'provisie_bedrag' ? `${eur(r.f.cons_waarde)} provisie` : `${eur(r.f.cons_waarde)} voor eigenaar`);
  const doorbelasten = sum(rows, (r) => r.klantArbeid + r.klantFacturen);
  return (
    <>
      <Rekensom
        regels={[
          { l: 'Vraagprijzen', v: t('prijs'), n: metAfspraak.length },
          { op: '−', l: 'Voor de eigenaren', v: t('eigenaarKrijgt') },
          { op: '=', l: 'Onze provisie', v: t('verdienste'), sub: true },
          { op: '−', l: 'Eigen kosten (transport, facturen, uren)', v: t('totaal') },
        ]}
        totaal={{ l: 'Verwacht resultaat consignatie', v: t('marge') }} />
      {doorbelasten > 0 && <Rekensom regels={[]} totaal={{ l: 'Nog door te belasten aan eigenaren', v: doorbelasten, uitleg: 'uren en onderdelen "voor de klant"' }} />}
      {zonder > 0 && <div className="banner warn">{zonder} consignatie-auto{zonder === 1 ? ' heeft' : "'s hebben"} nog geen afspraak of vraagprijs en {zonder === 1 ? 'telt' : 'tellen'} niet mee. Vul de afspraak in bij het dossier.</div>}
      <p className="hint">Consignatie-auto's tellen niet mee in Op voorraad, Voorraadwaarde, Geïnvesteerd en Verwachte marge. Bij verkoop telt het resultaat wel mee in Marge verkocht.</p>
      <PerAuto n={rows.length}>
        <AutoTabel open={open} rows={rows} start={{ k: 'tot', dir: 'asc' }}
          kolommen={[autoKol,
            { k: 'eig', l: 'Eigenaar', mv: true, v: (r) => r.eig?.naam || null },
            { k: 'afspraak', l: 'Afspraak', mv: true, v: (r) => afspraakTekst(r), toon: (r) => afspraakTekst(r) || <span className="chip bad">geen afspraak</span> },
            { k: 'tot', l: 'Loopt tot', v: (r) => r.f.cons_tot || null, toon: (r) => (r.f.cons_tot ? fmtD(r.f.cons_tot) : '—') },
            { k: 'prijs', l: 'Vraagprijs', r: true, mv: true, v: (r) => r.prijs, toon: (r) => (r.prijs != null ? eur(r.prijs) : '—') },
            { k: 'verd', l: 'Provisie', r: true, v: (r) => r.verdienste, toon: (r) => (r.verdienste != null ? <b>{eur(r.verdienste)}</b> : '—') },
          ]} />
      </PerAuto>
    </>
  );
}

// Dezelfde panelen, los te gebruiken op de pagina Financiën
export const PANELEN = { voorraad: Voorraad, waarde: Waarde, investering: Investering, marge: Marge, verkocht: Verkocht, uren: Uren, consignatie: Consignatie };
