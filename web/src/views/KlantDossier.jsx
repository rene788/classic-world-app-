import { useState } from 'react';
import { useApp, Plate, Status, useUrls, DocLink } from '../ui';
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
    <div className="detail dossier kd">
      <button className="btn ghost sm back" onClick={() => setNav((n) => ({ ...n, carId: null }))}>← Terug naar lijst</button>
      <section className="hero">
        {urls[c.foto] ? <img className="hero-img" src={urls[c.foto]} alt={`Foto ${carName(c)}`} />
          : <div className="hero-leeg"><svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 15l2-5a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 10l2 5v3h-2.5M5.5 18H3v-3m5.5 3h7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg></div>}
        <div className="hero-kaart">
          <div className="eyebrow">{[c.merk, c.bouwjaar].filter(Boolean).join(' · ')}</div>
          <h2 className="d-title">{carName(c)}</h2>
          <dl className="hero-meta">
            <div><dt>Status</dt><dd><Status s={c.status} c={c} /></dd></div>
            {c.kenteken && <div><dt>Kenteken</dt><dd><Plate c={c} /></dd></div>}
            {klant?.prijs && <div><dt>Vraagprijs</dt><dd className="num">{prijs != null ? eur(prijs) : 'Op aanvraag'}</dd></div>}
          </dl>
          {c.doc_link && <div className="hero-acties"><DocLink c={c} /></div>}
        </div>
      </section>
      <div className="d-grid">
        <section className="sec">
          <h3>Foto's <span className="aux">{fotos.length}</span></h3>
          {!fotos.length ? <p className="note">Er zijn nog geen foto's van deze auto.</p> : (
            <div className="gal kd-gal">{fotos.map((m) => (
              <div key={m.id} className="ph">{urls[m.pad] ? <img src={urls[m.pad]} alt={m.naam || 'Foto'} loading="lazy" onClick={() => setBig(m)} /> : null}</div>
            ))}</div>
          )}
        </section>
        <aside className="gegevens">
          <h3>Gegevens</h3>
          <dl>
            <Fact k="Merk" v={c.merk} />
            <Fact k="Model" v={[c.model, c.type].filter(Boolean).join(' ')} />
            <Fact k="Bouwjaar" v={c.bouwjaar} />
            <Fact k="Kleur" v={c.kleur} />
            <Fact k="Kilometerstand" v={km(c.km)} />
            {klant?.prijs && <Fact k="Vraagprijs" v={prijs != null ? eur(prijs) : 'Op aanvraag'} />}
          </dl>
        </aside>
      </div>
      {big && (
        <div className="scrim" onClick={() => setBig(null)}>
          <div className="lightbox"><img src={urls[big.pad]} alt={big.naam || 'Foto'} /></div>
        </div>
      )}
    </div>
  );
}

const Fact = ({ k, v }) => <div className="fact"><dt>{k}</dt><dd>{v || '—'}</dd></div>;
