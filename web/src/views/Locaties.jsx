import { useState } from 'react';
import { useApp, Modal, Field, Sel, CarFoto, useUrls, Empty, Status } from '../ui';
import { carLabel, daysSince, opVoorraad, norm, EXTERN_TE_LANG } from '../lib';

// Waar staat welke auto? Een tegel per locatie, garageboxen samen in één tegel.
// Verplaatsen gaat via de databasefunctie verplaats_auto, zodat monteurs alleen de locatie kunnen wijzigen.
const SOORTEN = [['intern', 'Eigen locatie'], ['box', 'Garagebox'], ['extern', 'Extern (partner of elders)']];
const dagenOp = (c) => daysSince(c.locatie_sinds || c.datum_binnen);
const MAX_ZICHT = 8; // langere vakken tonen eerst 8 auto's
const leesSet = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k)) || []); } catch { return new Set(); } };
const bewaarSet = (k, set) => { try { localStorage.setItem(k, JSON.stringify([...set])); } catch { /* geen opslag */ } };
const kortNaam = (c) => (c.voorraadnr ? '#' + c.voorraadnr + ' · ' : '') + ([c.model, c.type].filter(Boolean).join(' ') || c.merk || 'Auto');

export default function Locaties() {
  const { d, act, werker, geld, openCar } = useApp();
  const [q, setQ] = useState('');
  const [kies, setKies] = useState(null); // auto die verplaatst wordt
  const [beheer, setBeheer] = useState(false);
  const [over, setOver] = useState(null);
  // Per apparaat onthouden: ingeklapte vakken, verborgen vakken en vakken waarvan je alles wilt zien
  const [dicht, setDicht] = useState(() => leesSet('locaties-dicht'));
  const [weg, setWeg] = useState(() => leesSet('locaties-verborgen'));
  const [alles, setAlles] = useState(() => new Set());
  const [kiesVak, setKiesVak] = useState(false);
  const wissel = (set, setter, key, id) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); if (key) bewaarSet(key, n); };
  const s = norm(q);
  const autos = d.autos.filter(opVoorraad);
  const past = (c) => !s || norm([c.voorraadnr, c.merk, c.model, c.type, c.kenteken, c.kleur, c.locatie_info, d.locNaam(c.locatie)].join(' ')).includes(s);
  const actief = d.locaties.filter((l) => l.actief);
  const op = (id) => autos.filter((c) => c.locatie === id && c.status !== 'onderweg');
  const fotos = useUrls(autos.map((c) => c.foto).filter(Boolean));
  const boxen = actief.filter((l) => l.soort === 'box');
  const tegels = actief.filter((l) => l.soort !== 'box');
  const onderweg = autos.filter((c) => c.status === 'onderweg');
  const zonder = autos.filter((c) => c.status !== 'onderweg' && (!c.locatie || !d.locById[c.locatie]));
  const teLang = autos.filter((c) => d.locById[c.locatie]?.soort === 'extern' && dagenOp(c) > EXTERN_TE_LANG);

  const verplaats = (c, locId, info) => {
    if (!c || (c.locatie || null) === (locId || null) && info === undefined) return Promise.resolve(false);
    const naar = locId ? d.locNaam(locId) : 'geen locatie';
    return act(async (db) => { await db.rpc('verplaats_auto', { p_auto: c.id, p_locatie: locId || null, p_info: info ?? (d.locById[locId]?.soort === 'extern' && c.locatie === locId ? c.locatie_info : null) }); },
      `${kortNaam(c)} → ${naar}`, ['autos', 'wijzigingen']);
  };
  const drop = (locId) => werker ? {
    onDragOver: (e) => { e.preventDefault(); if (over !== locId) setOver(locId); },
    onDragLeave: () => setOver((o) => (o === locId ? null : o)),
    onDrop: (e) => { e.preventDefault(); setOver(null); verplaats(d.autoById[e.dataTransfer.getData('text/plain')], locId); },
  } : {};
  const auto = (c, extern) => {
    const dg = dagenOp(c);
    const lang = extern && dg > EXTERN_TE_LANG;
    if (!past(c)) return null;
    return (
      <button key={c.id} className={`la${lang ? ' lang' : ''}`} draggable={werker} onDragStart={(e) => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; }}
        onClick={() => setKies(c)} title={carLabel(c)}>
        <CarFoto c={c} url={fotos[c.foto]} sm />
        <span className="la-t"><b>{kortNaam(c)}</b>
          <small>{[extern && c.locatie_info, dg != null && (dg === 0 ? 'sinds vandaag' : `${dg} ${dg === 1 ? 'dag' : 'dagen'}`), lang && 'te lang'].filter(Boolean).join(' · ')}</small></span>
      </button>
    );
  };
  const tegel = ({ l, cars, sub, vrij }) => {
    const sleutel = l.id || 'geen';
    if (weg.has(sleutel) && !s) return null;
    const n = cars.length;
    const vol = l.plekken && n >= l.plekken;
    const zicht = cars.filter(past);
    if (s && !zicht.length && !norm(l.naam).includes(s)) return null;
    const ingeklapt = dicht.has(sleutel) && !s; // bij zoeken altijd de gevonden auto's tonen
    const lijst = s || alles.has(sleutel) ? zicht : zicht.slice(0, MAX_ZICHT);
    return (
      <section key={sleutel} className={`lt${over === l.id ? ' over' : ''}${l.soort === 'extern' ? ' ext' : ''}${ingeklapt ? ' dicht' : ''}`} {...(vrij ? {} : drop(l.id))}>
        <header>
          <button className="lt-kop" onClick={() => wissel(dicht, setDicht, 'locaties-dicht', sleutel)} aria-expanded={!ingeklapt} title={ingeklapt ? 'Uitklappen' : 'Inklappen'}>
            <span className="lt-pijl" aria-hidden="true">{ingeklapt ? '▸' : '▾'}</span><h3>{l.naam}</h3>
          </button>
          <small>{sub || (l.plekken ? `${n} van ${l.plekken} plekken` : `${n} auto${n === 1 ? '' : "'s"}`)}</small>
        </header>
        {l.plekken > 0 && <div className={`lt-bar${vol ? ' vol' : ''}`}><i style={{ width: `${Math.min(100, Math.round((n / l.plekken) * 100))}%` }} /></div>}
        {ingeklapt ? (werker && !vrij ? <span className="note">Ingeklapt · sleep hierheen</span> : null)
          : !n ? <span className="note">Leeg</span> : <>
            {lijst.map((c) => auto(c, l.soort === 'extern'))}
            {!s && zicht.length > MAX_ZICHT && <button className="btn ghost sm lt-meer" onClick={() => wissel(alles, setAlles, null, sleutel)}>{alles.has(sleutel) ? 'Minder tonen' : `Toon alle ${zicht.length}`}</button>}
          </>}
      </section>
    );
  };
  const alleVakken = [...tegels.filter((l) => l.soort === 'intern'), ...(boxen.length ? [{ id: 'boxen', naam: 'Garageboxen' }] : []), ...tegels.filter((l) => l.soort === 'extern'),
    ...(zonder.length ? [{ id: 'geen', naam: 'Geen locatie' }] : []), ...(onderweg.length ? [{ id: 'onderweg', naam: 'Onderweg' }] : [])];
  const allesDicht = alleVakken.every((v) => dicht.has(v.id));
  const zetAllesDicht = () => { const n = allesDicht ? new Set() : new Set(alleVakken.map((v) => v.id)); setDicht(n); bewaarSet('locaties-dicht', n); };

  return (
    <div className="loc-p">
      <div className="filters">
        <input className="in" style={{ flex: '1 1 220px' }} placeholder="Zoek auto of locatie…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoeken" />
        <span className="note">{autos.length - onderweg.length} auto&apos;s op locatie{zonder.length ? ` · ${zonder.length} zonder locatie` : ''}{teLang.length ? ` · ${teLang.length} te lang extern` : ''}</span>
        <button className="btn" onClick={zetAllesDicht}>{allesDicht ? 'Alles uitklappen' : 'Alles inklappen'}</button>
        <button className="btn" onClick={() => setKiesVak(true)} aria-haspopup="dialog">Vakken{weg.size ? ` (${weg.size} verborgen)` : ''}</button>
        {geld && <button className="btn" onClick={() => setBeheer(true)}>Locaties beheren</button>}
      </div>
      {werker && <p className="note" style={{ margin: '0 0 10px' }}>Sleep een auto naar een andere locatie, of tik erop om hem te verplaatsen.</p>}
      <div className="lt-grid">
        {tegels.filter((l) => l.soort === 'intern').map((l) => tegel({ l, cars: op(l.id) }))}
        {boxen.length > 0 && (!weg.has('boxen') || s) && <Boxen boxen={boxen} op={op} past={past} over={over} drop={drop} kies={setKies} dicht={dicht.has('boxen') && !s} onWissel={() => wissel(dicht, setDicht, 'locaties-dicht', 'boxen')} />}
        {tegels.filter((l) => l.soort === 'extern').map((l) => tegel({ l, cars: op(l.id) }))}
        {zonder.length > 0 && tegel({ l: { id: '', naam: 'Geen locatie', soort: 'leeg' }, cars: zonder, sub: `${zonder.length} auto${zonder.length === 1 ? '' : "'s"} · vul in waar ze staan` })}
        {onderweg.length > 0 && tegel({ vrij: true, l: { id: 'onderweg', naam: 'Onderweg', soort: 'leeg' }, cars: onderweg, sub: 'nog niet binnen' })}
      </div>
      {!autos.length && <div className="pane"><Empty title="Nog geen auto's">Auto&apos;s op voorraad verschijnen hier op hun locatie.</Empty></div>}
      {kies && <Verplaats c={kies} onClose={() => setKies(null)} verplaats={verplaats} openCar={openCar} />}
      {beheer && <LocBeheer onClose={() => setBeheer(false)} />}
      {kiesVak && (
        <Modal title="Welke vakken wil je zien?" onClose={() => setKiesVak(false)} footer={<>
          {weg.size > 0 && <button className="btn" style={{ marginRight: 'auto' }} onClick={() => { const n = new Set(); setWeg(n); bewaarSet('locaties-verborgen', n); }}>Alles tonen</button>}
          <button className="btn primary" onClick={() => setKiesVak(false)}>Klaar</button></>}>
          <p className="note" style={{ margin: 0 }}>Verborgen vakken zie je niet meer op dit apparaat. Zoek je een auto, dan wordt hij toch gevonden. Auto&apos;s blijven gewoon op hun locatie staan.</p>
          <div className="vak-kies">
            {alleVakken.map((v) => (
              <label key={v.id} className="chk"><input type="checkbox" checked={!weg.has(v.id)} onChange={() => wissel(weg, setWeg, 'locaties-verborgen', v.id)} /> {v.naam}</label>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Boxen({ boxen, op, past, over, drop, kies, dicht, onWissel }) {
  const { d, act, geld } = useApp();
  const bezet = boxen.filter((b) => op(b.id).length || d.boxen[b.id]).length;
  const vol = (k, v) => act((db) => db.upsert('boxen', { locatie: k, vol: v }), null, ['boxen']);
  return (
    <section className={`lt lt-boxen${dicht ? ' dicht' : ''}`}>
      <header>
        <button className="lt-kop" onClick={onWissel} aria-expanded={!dicht} title={dicht ? 'Uitklappen' : 'Inklappen'}><span className="lt-pijl" aria-hidden="true">{dicht ? '▸' : '▾'}</span><h3>Garageboxen</h3></button>
        <small>{bezet} van {boxen.length} bezet</small>
      </header>
      {!dicht && <div className="bx-grid">
        {boxen.map((b) => {
          const cars = op(b.id);
          const nr = b.naam.replace(/^garagebox\s*/i, '') || b.naam;
          const dim = cars.length && !cars.some(past);
          return (
            <div key={b.id} className={`bx${cars.length ? ' has' : ''}${d.boxen[b.id] ? ' vol' : ''}${over === b.id ? ' over' : ''}${dim ? ' dim' : ''}`} {...drop(b.id)}>
              <div className="bx-h"><b>{nr}</b>
                {geld && <label className="volchk" title="Vink aan als er niets meer bij kan (meerdere auto's of spullen)"><input type="checkbox" checked={!!d.boxen[b.id]} onChange={(e) => vol(b.id, e.target.checked)} />vol</label>}</div>
              {cars.map((c) => <button key={c.id} className="linkish bx-a" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)} onClick={() => kies(c)} title={carLabel(c)}>{c.voorraadnr ? '#' + c.voorraadnr : c.merk}<small>{[c.model, c.type].filter(Boolean).join(' ')}</small></button>)}
              {!cars.length && <span className="note">{d.boxen[b.id] ? 'vol (spullen)' : 'leeg'}</span>}
            </div>
          );
        })}
      </div>}
    </section>
  );
}

function Verplaats({ c, onClose, verplaats, openCar }) {
  const { d, werker } = useApp();
  const [naar, setNaar] = useState(c.locatie && d.locById[c.locatie] ? c.locatie : '');
  const [info, setInfo] = useState(c.locatie_info || '');
  const ext = d.locById[naar]?.soort === 'extern';
  const groepen = SOORTEN.map(([k, l]) => [l, d.locaties.filter((x) => x.actief && x.soort === k)]).filter(([, ls]) => ls.length);
  const opslaan = async () => { if (await verplaats(c, naar || null, ext ? info.trim() : null)) onClose(); };
  const dg = dagenOp(c);
  return (
    <Modal title={carLabel(c)} onClose={onClose}
      footer={<>
        <button className="btn" style={{ marginRight: 'auto' }} onClick={() => { onClose(); openCar(c.id); }}>Dossier openen</button>
        <button className="btn" onClick={onClose}>{werker ? 'Annuleren' : 'Sluiten'}</button>
        {werker && <button className="btn primary" onClick={opslaan}>Verplaatsen</button>}
      </>}>
      <div className="pk-m"><Status s={c.status} /><span className="note">Nu: <b>{d.locNaam(c.locatie) || 'geen locatie'}</b>{c.locatie_info ? ` (${c.locatie_info})` : ''}{dg != null && c.locatie ? ` · ${dg === 0 ? 'sinds vandaag' : `${dg} ${dg === 1 ? 'dag' : 'dagen'}`}` : ''}</span></div>
      {werker && <>
        <Field label="Verplaatsen naar">
          <select className="in" value={naar} onChange={(e) => setNaar(e.target.value)}>
            <option value="">Geen locatie / onbekend</option>
            {groepen.map(([l, ls]) => <optgroup key={l} label={l}>{ls.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</optgroup>)}
          </select>
        </Field>
        {ext && <Field label={naar === 'extern' ? 'Waar precies?' : 'Waarvoor? (optioneel)'}><input className="in" value={info} onChange={(e) => setInfo(e.target.value)} maxLength={120} placeholder={naar === 'extern' ? 'bijv. bij Frans' : 'bijv. lakwerk motorkap'} /></Field>}
      </>}
    </Modal>
  );
}

// Locaties toevoegen, hernoemen, plekken instellen, volgorde en archiveren (verkoop en beheer)
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34) || 'locatie';

function LocBeheer({ onClose }) {
  const { d, act, beheerder } = useApp();
  const [nieuw, setNieuw] = useState({ naam: '', soort: 'intern', plekken: '' });
  const [fout, setFout] = useState('');
  const n = (id) => d.autos.filter((c) => c.locatie === id).length;
  const upd = (l, patch, msg) => act((db) => db.update('locaties', l.id, patch), msg, ['locaties']);
  const plek = (v) => { const x = parseInt(String(v).trim(), 10); return Number.isFinite(x) && x > 0 ? Math.min(500, x) : null; };
  const voegToe = async () => {
    const naam = nieuw.naam.trim();
    if (!naam) { setFout('Vul een naam in.'); return; }
    if (d.locaties.some((l) => norm(l.naam) === norm(naam))) { setFout('Er is al een locatie met deze naam.'); return; }
    let id = slug(naam); let i = 2; while (d.locById[id]) id = `${slug(naam)}-${i++}`;
    const volgorde = Math.max(0, ...d.locaties.filter((l) => l.soort === nieuw.soort).map((l) => l.volgorde)) + 1;
    if (await act((db) => db.insert('locaties', { id, naam, soort: nieuw.soort, plekken: plek(nieuw.plekken), volgorde, actief: true }), `${naam} toegevoegd`, ['locaties'])) setNieuw({ naam: '', soort: nieuw.soort, plekken: '' });
  };
  const schuif = (l, r) => {
    const rij = d.locaties.filter((x) => x.soort === l.soort);
    const i = rij.findIndex((x) => x.id === l.id); const ander = rij[i + r];
    if (!ander) return;
    act(async (db) => { await db.update('locaties', l.id, { volgorde: ander.volgorde }); await db.update('locaties', ander.id, { volgorde: l.volgorde === ander.volgorde ? l.volgorde + r : l.volgorde }); }, null, ['locaties']);
  };
  const weg = (l) => act((db) => db.remove('locaties', l.id), `${l.naam} verwijderd`, ['locaties']);
  return (
    <Modal title="Locaties beheren" onClose={onClose} wide footer={<button className="btn primary" onClick={onClose}>Klaar</button>}>
      <div className="lb-nieuw">
        <input className="in" value={nieuw.naam} onChange={(e) => { setNieuw({ ...nieuw, naam: e.target.value }); setFout(''); }} placeholder="Nieuwe locatie, bijv. Loods 2 of Bekleder De Vries" aria-label="Naam" maxLength={60} />
        <Sel value={nieuw.soort} onChange={(v) => setNieuw({ ...nieuw, soort: v })} options={SOORTEN} aria-label="Soort" />
        <input className="in" style={{ width: 90 }} inputMode="numeric" value={nieuw.plekken} onChange={(e) => setNieuw({ ...nieuw, plekken: e.target.value })} placeholder="Plekken" aria-label="Aantal plekken" />
        <button className="btn primary" onClick={voegToe}>Toevoegen</button>
        {fout && <span className="note bad">{fout}</span>}
      </div>
      {SOORTEN.map(([k, titel]) => {
        const rij = d.locaties.filter((l) => l.soort === k);
        if (!rij.length) return null;
        return (
          <div key={k}>
            <h3 className="kp-h">{titel}</h3>
            <div className="lb-lijst">
              {rij.map((l, i) => (
                <div key={l.id} className={`lb-r${l.actief ? '' : ' uit'}`}>
                  <span className="lb-pijl">
                    <button className="btn ghost sm" disabled={!i} onClick={() => schuif(l, -1)} aria-label={`${l.naam} omhoog`}>↑</button>
                    <button className="btn ghost sm" disabled={i === rij.length - 1} onClick={() => schuif(l, 1)} aria-label={`${l.naam} omlaag`}>↓</button>
                  </span>
                  <input className="in" defaultValue={l.naam} maxLength={60} aria-label="Naam"
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== l.naam) upd(l, { naam: v }, 'Naam aangepast'); else e.target.value = l.naam; }} />
                  <input className="in lb-plek" defaultValue={l.plekken ?? ''} inputMode="numeric" placeholder="plekken" aria-label={`Plekken ${l.naam}`}
                    onBlur={(e) => { const v = plek(e.target.value); if (v !== (l.plekken ?? null)) upd(l, { plekken: v }, 'Plekken aangepast'); e.target.value = v ?? ''; }} />
                  <span className="note lb-n">{n(l.id)} auto{n(l.id) === 1 ? '' : "'s"}</span>
                  <label className="chk"><input type="checkbox" checked={l.actief} onChange={(e) => upd(l, { actief: e.target.checked }, e.target.checked ? `${l.naam} weer in gebruik` : `${l.naam} gearchiveerd`)} /> in gebruik</label>
                  {beheerder && !n(l.id) && <button className="btn ghost sm" onClick={() => weg(l)} aria-label={`${l.naam} verwijderen`}>Verwijderen</button>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="hint" style={{ margin: 0 }}>Een locatie die niet meer in gebruik is, verdwijnt uit de keuzelijsten. Auto&apos;s die er nog staan, houden hem. Verwijderen kan alleen als er geen auto meer staat.</p>
    </Modal>
  );
}
