import { useState } from 'react';
import { useApp, Modal, Field, Sel, Plate, Nr, Status, Loc, Empty, useForm, useUrls, CarFoto } from '../ui';
import { STATUSES, LOCATIES, BESTEMMING, carName, norm, num, int, nextNr, today, eur, eurVrij, daysSince, isCons, consNr, opVoorraad } from '../lib';
import AutoDossier from './AutoDossier';
import KlantDossier from './KlantDossier';
import { Wie } from './Planning';

export default function Voorraad() {
  const { d, nav, setNav, geld, klant, showroom } = useApp();
  const [q, setQ] = useState('');
  const [st, setSt] = useState('actief');
  const [loc, setLoc] = useState('');
  const [srt, setSrt] = useState('');
  const [form, setForm] = useState(null);

  const s = norm(q);
  const list = d.autos
    .filter((c) => (showroom ? klant.statussen.includes(c.status) : st === 'alle' || (st === 'actief' ? opVoorraad(c) : c.status === st)))
    .filter((c) => showroom || !loc || c.locatie === loc)
    .filter((c) => showroom || !srt || (srt === 'consignatie') === isCons(c))
    .filter((c) => !s || norm([c.voorraadnr, c.chassisnr, c.kenteken, c.merk, c.model, c.type, c.kleur, c.bouwjaar].join(' ')).includes(s))
    .sort((a, b) => String(b.voorraadnr || '').localeCompare(String(a.voorraadnr || ''), 'nl', { numeric: true }) || (b.aangemaakt || '').localeCompare(a.aangemaakt || ''));

  const car = nav.carId && d.autoById[nav.carId];
  const fotoUrls = useUrls(list.map((c) => c.foto));

  return (
    <div className={`split${car ? ' has-detail' : ''}`}>
      <section className="pane list-pane" aria-label="Voorraadlijst">
        <div className="pane-h">
          <input className="in search" placeholder="Zoek op nr, chassis, kenteken, merk…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoeken in voorraad" />
          {geld && <button className="btn primary" onClick={() => setForm({})}>+ Auto</button>}
          {!showroom && <div style={{ display: 'flex', gap: 6, width: '100%' }}>
            <Sel value={st} onChange={setSt} options={[['actief', 'Op voorraad'], ...STATUSES, ['alle', 'Alle auto\'s']]} aria-label="Status" />
            <Sel value={loc} onChange={setLoc} options={LOCATIES} empty="Alle locaties" aria-label="Locatie" />
            <Sel value={srt} onChange={setSrt} options={[['eigen', 'Eigen voorraad'], ['consignatie', 'Consignatie']]} empty="Eigen + consignatie" aria-label="Eigen of consignatie" />
          </div>}
        </div>
        <div className="list">
          {!list.length ? <Empty title={d.autos.length ? 'Niets gevonden' : 'Nog geen auto\'s'}>{d.autos.length ? 'Pas de zoekterm of filters aan.' : geld ? 'Voeg de eerste auto toe met de knop + Auto.' : 'Zodra verkoop een auto toevoegt, zie je hem hier.'}</Empty>
            : list.map((c) => {
              const open = d.taken.filter((t) => t.auto_id === c.id && !t.klaar).length;
              const matches = geld ? d.matchesForCar(c).filter((m) => !m.informed).length : 0;
              const dg = daysSince(c.datum_binnen);
              return (
                <button key={c.id} className={`row met-foto${car && car.id === c.id ? ' sel' : ''}`} onClick={() => setNav((n) => ({ ...n, carId: c.id }))}>
                  <CarFoto c={c} url={fotoUrls[c.foto]} />
                  <span className="row-t">{carName(c)}{c.bouwjaar ? <span className="note"> · {c.bouwjaar}</span> : null}</span>
                  <Status s={c.status} />
                  <span className="row-m">
                    {showroom ? <>
                      <Plate c={c} />{c.kleur && <span className="chip">{c.kleur}</span>}
                      {klant.prijs && d.prijsOf(c) ? <span className="chip">{eurVrij(d.prijsOf(c))}</span> : null}
                    </> : <>
                    <Nr c={c} />{!klant && isCons(c) && <span className="chip cons">Consignatie</span>}<Plate c={c} /><Loc c={c} />{c.toegewezen_aan && <Wie d={d} t={c} />}
                    {open > 0 && <span className="chip">{open} open</span>}
                    {matches > 0 && <span className="chip match">{matches} match{matches > 1 ? 'es' : ''}</span>}
                    {geld && d.prijsOf(c) ? <span className="chip">{eur(d.prijsOf(c))}</span> : null}
                    {klant?.prijs && d.prijsOf(c) ? <span className="chip">{eurVrij(d.prijsOf(c))}</span> : null}
                    {!klant && opVoorraad(c) && c.status !== 'onderweg' && dg != null && dg > 90 && <span className="chip bad">{dg} dagen</span>}
                    </>}
                  </span>
                </button>
              );
            })}
        </div>
      </section>
      <section className="pane detail-pane" aria-label="Dossier">
        {car && showroom ? <KlantDossier car={car} />
          : car ? <AutoDossier car={car} onEdit={() => setForm(car)} />
          : <Empty title="Kies een auto">{showroom ? 'Klik links op een auto voor foto\'s en gegevens.' : `Klik links op een auto om het dossier te openen: taken, uren, onderdelen, foto's${geld ? ', kosten en marge' : ''}.`}</Empty>}
      </section>
      {form && <CarForm car={form.id ? form : null} onClose={() => setForm(null)} />}
    </div>
  );
}

export function CarForm({ car, onClose }) {
  const { d, act, setNav, geld } = useApp();
  const fin = (car && d.finByAuto[car.id]) || {};
  const [f, set] = useForm({
    voorraadnr: car?.voorraadnr ?? nextNr(d.autos), chassisnr: car?.chassisnr ?? '', kenteken: car?.kenteken ?? '',
    merk: car?.merk ?? '', model: car?.model ?? '', type: car?.type ?? '', bouwjaar: car?.bouwjaar ?? '', kleur: car?.kleur ?? '',
    km: car?.km ?? '', status: car?.status ?? 'binnen', locatie: car?.locatie ?? '', locatie_info: car?.locatie_info ?? '',
    datum_binnen: car?.datum_binnen ?? today(), bestemming: car?.bestemming ?? '', omschrijving: car?.omschrijving ?? '',
    inkoopprijs: fin.inkoopprijs ?? '', vraagprijs: fin.vraagprijs ?? '', soort: car?.soort ?? 'eigen',
  });
  const consVast = consNr(f.voorraadnr);
  const cons = consVast || f.soort === 'consignatie';
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.merk.trim() && !f.model.trim()) return alertMsg('Vul minstens merk of model in.');
    setBusy(true);
    const row = {
      voorraadnr: f.voorraadnr.trim() || null, chassisnr: f.chassisnr.trim() || null, kenteken: f.kenteken.trim().toUpperCase() || null,
      merk: f.merk.trim(), model: f.model.trim(), type: f.type.trim(), bouwjaar: int(f.bouwjaar), kleur: f.kleur.trim() || null,
      km: int(f.km), status: f.status, locatie: f.locatie || null, locatie_info: f.locatie === 'extern' ? (f.locatie_info.trim() || null) : null,
      datum_binnen: f.datum_binnen || null, bestemming: f.bestemming || null, omschrijving: f.omschrijving.trim() || null,
      soort: cons ? 'consignatie' : 'eigen',
    };
    const res = await act(async (db) => {
      const saved = car ? await db.update('autos', car.id, row) : await db.insert('autos', row);
      const ink = cons ? (fin.inkoopprijs ?? null) : num(f.inkoopprijs), vr = num(f.vraagprijs);
      if (geld && (ink != null || vr != null || d.finByAuto[saved.id])) {
        await db.upsert('auto_financien', { auto_id: saved.id, inkoopprijs: ink, vraagprijs: vr });
      }
      return saved;
    }, car ? 'Auto bijgewerkt' : 'Auto toegevoegd', ['autos', 'auto_financien']);
    setBusy(false);
    if (res) { if (!car) setNav((n) => ({ ...n, carId: res.id })); onClose(); }
  };
  const [msg, alertMsg] = useState('');

  return (
    <Modal title={car ? 'Auto wijzigen' : 'Auto toevoegen'} onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Annuleren</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Opslaan…' : 'Opslaan'}</button></>}>
      {msg && <div className="banner warn">{msg}</div>}
      <div className="grid2">
        <Field label="Voorraadnummer"><input className="in mono" value={f.voorraadnr} onChange={set('voorraadnr')} placeholder="bijv. 2026-014" autoFocus /></Field>
        <Field label="Chassisnummer"><input className="in mono" value={f.chassisnr} onChange={set('chassisnr')} /></Field>
        <Field label="Kenteken"><input className="in mono" value={f.kenteken} onChange={set('kenteken')} /></Field>
        <Field label="Soort">
          <Sel value={cons ? 'consignatie' : 'eigen'} onChange={set('soort')} disabled={consVast} options={[['eigen', 'Eigen voorraad'], ['consignatie', 'Consignatie']]} />
        </Field>
      </div>
      {consVast && <p className="hint" style={{ marginTop: -6 }}>Voorraadnummers 200 t/m 299 zijn altijd consignatie.</p>}
      <div className="grid2">
        <Field label="Merk"><input className="in" value={f.merk} onChange={set('merk')} placeholder="Porsche" /></Field>
        <Field label="Model"><input className="in" value={f.model} onChange={set('model')} placeholder="911" /></Field>
        <Field label="Type / uitvoering"><input className="in" value={f.type} onChange={set('type')} placeholder="993 Carrera Cabriolet" /></Field>
      </div>
      <div className="grid2">
        <Field label="Bouwjaar"><input className="in" inputMode="numeric" value={f.bouwjaar} onChange={set('bouwjaar')} /></Field>
        <Field label="Kleur"><input className="in" value={f.kleur} onChange={set('kleur')} /></Field>
        <Field label="Kilometerstand"><input className="in" inputMode="numeric" value={f.km} onChange={set('km')} /></Field>
      </div>
      <div className="grid2">
        <Field label="Status"><Sel value={f.status} onChange={set('status')} options={STATUSES} /></Field>
        <Field label="Locatie"><Sel value={f.locatie} onChange={set('locatie')} options={LOCATIES} empty="Onbekend" /></Field>
        {f.locatie === 'extern' && <Field label="Waar precies?"><input className="in" value={f.locatie_info} onChange={set('locatie_info')} placeholder="bijv. spuiterij Jansen" /></Field>}
        <Field label="Binnengekomen op"><input className="in" type="date" value={f.datum_binnen} onChange={set('datum_binnen')} /></Field>
        <Field label="Bestemming bij verkoop"><Sel value={f.bestemming} onChange={set('bestemming')} options={BESTEMMING} empty="Nog niet bekend" /></Field>
      </div>
      {geld && (
        <div className="grid2">
          {!cons && <Field label="Inkoopprijs (€)"><input className="in" inputMode="decimal" value={f.inkoopprijs} onChange={set('inkoopprijs')} /></Field>}
          <Field label="Vraagprijs (€)"><input className="in" inputMode="decimal" value={f.vraagprijs} onChange={set('vraagprijs')} /></Field>
        </div>
      )}
      <Field label="Omschrijving en bijzonderheden"><textarea className="in" value={f.omschrijving} onChange={set('omschrijving')} /></Field>
      {geld && <p className="hint">Prijzen zijn alleen zichtbaar voor verkoop en beheerder, nooit voor monteurs.{cons ? ' De afspraak met de eigenaar vul je in het dossier in, bij Consignatie.' : ''}</p>}
    </Modal>
  );
}
