import { useEffect, useState } from 'react';

// Korte rondleiding langs de schermen die deze gebruiker heeft. Elke stap opent het scherm erbij.
const STAPPEN = [
  { view: 'overzicht', t: 'Dashboard', x: 'Je startpunt. De blokken bovenaan zijn klikbaar: tik erop voor de rekensom en de auto\'s erachter. Daaronder staan signalen die aandacht vragen.' },
  { view: 'sinds', t: 'Wat is er nieuw', x: 'Sinds je laatste dienst: wat collega\'s aan auto\'s hebben veranderd terwijl je weg was: nieuwe taken, statuswijzigingen, onderdelen binnen, nieuwe foto\'s. Vink per auto af wat je gezien hebt.' },
  { view: 'voorraad', t: 'Voorraad', x: 'Alle auto\'s, als kaarten of als lijst. Tik op een auto voor het dossier met gegevens, werkplaats, foto\'s, kosten en verkoop.' },
  { view: 'locaties', t: 'Locaties', x: 'Waar staat welke auto? Een tegel per locatie met hoe lang de auto er al staat. Sleep een auto naar een andere plek, of tik erop. Auto\'s die te lang bij een externe partner staan, krijgen een melding.' },
  { view: 'werk', t: 'Mijn werk', x: 'De taken die aan jou zijn gegeven. Vink af wat klaar is en klok je uren op een auto.' },
  { view: 'werkplaats', t: 'Werkplaats', x: 'Alles wat in de werkplaats staat in één tabel: wat er moet gebeuren, wie eraan werkt en op welke onderdelen we wachten. Klantreparaties staan er ook in.' },
  { view: 'planning', t: 'Planning', x: 'Het weekbord: per persoon een rij, per dag een kolom. Sleep werk naar een andere dag of persoon, of tik op een leeg vak om werk toe te voegen. Monteurs stellen werk voor; verkoop of beheer geeft akkoord.' },
  { view: 'reparaties', t: 'Reparaties', x: 'Auto\'s van klanten die voor onderhoud of reparatie binnenkomen, los van de eigen voorraad. Met status, wie het oppakt en wanneer het klaar moet zijn.' },
  { view: 'bestellingen', t: 'Bestellingen', x: 'Facturen en bestellingen. Schakel naar "Per leverancier" om te zien wat er bij elke leverancier nog openstaat en zet het met één tik op ontvangen.' },
  { view: 'matches', t: 'Matches', x: 'Klanten met een zoekwens die past bij een auto op voorraad, en of ze al geïnformeerd zijn.' },
  { view: 'financien', t: 'Financiën', x: 'Alle geldzaken op één plek: geïnvesteerd, verwachte en gerealiseerde marge, consignatie en wat er nog openstaat.' },
  { view: 'uren', t: 'Uren', x: 'Gewerkte uren per persoon en per auto.' },
  { view: null, doel: 'klantmodus', t: 'Bekijk als klant', x: 'Laat je de app aan een klant zien? Zet onderin het menu de klantmodus aan: prijzen, kosten en klantgegevens verdwijnen dan.' },
];
const SLEUTEL = 'rondleiding-gezien';

export function rondleidingAlGezien() { try { return localStorage.getItem(SLEUTEL) === '1'; } catch { return true; } }

export default function Rondleiding({ tabs, go, onClose, klantmodus }) {
  const stappen = STAPPEN.filter((s) => (s.view ? tabs.includes(s.view) : s.doel === 'klantmodus' && klantmodus));
  const [i, setI] = useState(0);
  const s = stappen[i];
  useEffect(() => { if (s?.view) go(s.view, s.view === 'voorraad' ? { carId: null } : {}); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') klaar(); if (e.key === 'ArrowRight') volgende(); if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1)); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  const klaar = () => { try { localStorage.setItem(SLEUTEL, '1'); } catch { /* geen opslag */ } onClose(); };
  const volgende = () => (i < stappen.length - 1 ? setI(i + 1) : klaar());
  if (!s) return null;
  return (
    <div className="tour" role="dialog" aria-label="Rondleiding" aria-live="polite">
      <div className="tour-k">
        <span className="eyebrow">Rondleiding · {i + 1} van {stappen.length}</span>
        <button className="x" onClick={klaar} aria-label="Rondleiding sluiten">×</button>
      </div>
      <h3>{s.t}</h3>
      <p>{s.x}</p>
      <div className="tour-bol" aria-hidden="true">{stappen.map((x, n) => <i key={x.t} className={n === i ? 'aan' : n < i ? 'af' : ''} />)}</div>
      <div className="tour-f">
        <button className="btn ghost sm" onClick={klaar}>Overslaan</button>
        <span style={{ flex: 1 }} />
        {i > 0 && <button className="btn sm" onClick={() => setI(i - 1)}>Vorige</button>}
        <button className="btn primary sm" onClick={volgende} autoFocus>{i < stappen.length - 1 ? 'Volgende' : 'Klaar'}</button>
      </div>
    </div>
  );
}
