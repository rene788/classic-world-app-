import { useState } from 'react';
import { useApp, Plate, Status, useUrls, CarFoto, DocLink } from '../ui';
import { carName, eurVrij as eur, km } from '../lib';

// Dossier zoals een klant het mag zien: alleen de auto zelf, geen bedragen of interne gegevens
export default function KlantDossier({ car: c }) {
  const { d, setNav, klant } = useApp();
  const [big, setBig] = useState(null);
  const fotos = d.media
    .filter((m) => m.auto_id === c.id && (m.soort || '').startsWith('image/') && m.fase !== 'document' && !String(m.pad).startsWith('geld/'))
    .sort((a, b) => (a.fase === 'verkoop' ? -1 : 0) - (b.fase === 'verkoop' ? -1 : 0) || (a.aangemaakt || '').localeCompare(b.aangemaakt || ''));
  const urls = useUrls([c.foto, ...fotos.map((m) => m.pad)]);
  const prijs = klant?.prijs ? d.prijsOf(c) : null;

  return (
    <div className="detail kd">
      <div>
        <button className="btn ghost sm back" onClick={() => setNav((n) => ({ ...n, carId: null }))}>← Terug naar lijst</button>
        <div className="kd-head">
          <CarFoto c={c} url={urls[c.foto]} lg />
          <div style={{ minWidth: 0 }}>
            <h2 className="d-title">{carName(c)}{c.bouwjaar ? `, ${c.bouwjaar}` : ''}</h2>
            <div className="d-sub"><Status s={c.status} /><Plate c={c} lg /></div>
            {prijs != null && <p className="kd-prijs num">{eur(prijs)}</p>}
            {c.doc_link && <div style={{ marginTop: 12 }}><DocLink c={c} /></div>}
          </div>
        </div>
      </div>
      <dl className="facts">
        <Fact k="Merk" v={c.merk} />
        <Fact k="Model" v={[c.model, c.type].filter(Boolean).join(' ')} />
        <Fact k="Bouwjaar" v={c.bouwjaar} />
        <Fact k="Kleur" v={c.kleur} />
        <Fact k="Kilometerstand" v={km(c.km)} />
        {klant?.prijs && <Fact k="Vraagprijs" v={prijs != null ? eur(prijs) : 'Op aanvraag'} />}
      </dl>
      <section className="sec">
        <h3>Foto's <span className="aux">{fotos.length}</span></h3>
        {!fotos.length ? <p className="note">Er zijn nog geen foto's van deze auto.</p> : (
          <div className="gal kd-gal">{fotos.map((m) => (
            <div key={m.id} className="ph">{urls[m.pad] ? <img src={urls[m.pad]} alt={m.naam || 'Foto'} loading="lazy" onClick={() => setBig(m)} /> : null}</div>
          ))}</div>
        )}
      </section>
      {big && (
        <div className="scrim" onClick={() => setBig(null)}>
          <div className="lightbox"><img src={urls[big.pad]} alt={big.naam || 'Foto'} /></div>
        </div>
      )}
    </div>
  );
}

const Fact = ({ k, v }) => <div className="fact"><dt>{k}</dt><dd>{v || '—'}</dd></div>;
