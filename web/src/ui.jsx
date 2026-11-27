import { createContext, useContext, useEffect, useState } from 'react';
import { STL } from './lib';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function Modal({ title, onClose, children, footer, wide, sheet }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className={`scrim${sheet ? ' sheet' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 860 } : undefined}>
        <div className="modal-h"><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Sluiten">×</button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export const Field = ({ label, children, style }) => <label className="f" style={style}>{label}{children}</label>;

export function Sel({ value, onChange, options, empty, ...rest }) {
  return (
    <select className="in" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

// Verwijderknop met bevestiging door twee keer klikken
export function DelBtn({ onConfirm, label = 'Verwijderen', small, x }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  if (x && !armed) return <button className="x" title={label} aria-label={label} onClick={() => setArmed(true)}>×</button>;
  return (
    <button className={`btn danger${small || x ? ' sm' : ''}${armed ? ' armed' : ''}`} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? 'Zeker weten?' : label}
    </button>
  );
}

export const Plate = ({ c, lg }) => c.kenteken
  ? <span className={`plate${c.bouwjaar && c.bouwjaar < 1978 ? ' blue' : ''}${lg ? ' lg' : ''}`}>{c.kenteken.toUpperCase()}</span> : null;
export const Nr = ({ c, lg }) => c.voorraadnr
  ? <span className={`nr${lg ? ' lg' : ''}`}>#{c.voorraadnr}</span>
  : (lg ? <span className="nr none lg">geen voorraadnummer</span> : null);
export const Status = ({ s }) => <span className={`pill st-${s || 'binnen'}`}>{STL[s] || STL.binnen}</span>;
export const Loc = ({ c }) => c.locatie
  ? <LocNaam c={c} /> : null;
function LocNaam({ c }) {
  const { d } = useApp();
  return <span className="loc">{d.locNaam(c.locatie) + (d.locById[c.locatie]?.soort === 'extern' && c.locatie_info ? ': ' + c.locatie_info : '')}</span>;
}

// Tijdelijke links (1 uur) ophalen voor bestanden in de afgeschermde opslag
export function useUrls(paths) {
  const { act } = useApp();
  const [urls, setUrls] = useState({});
  const [tik, setTik] = useState(0);
  const key = [...new Set(paths.filter(Boolean))].sort().join('|');
  useEffect(() => { const t = setInterval(() => setTik((n) => n + 1), 50 * 60 * 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    act((db) => db.urls(key.split('|'))).then((m) => { if (live && m && typeof m === 'object') setUrls((o) => ({ ...o, ...m })); });
    return () => { live = false; };
  }, [key, act, tik]);
  return urls;
}

// Profielfoto van een auto; zonder foto een grijs vlak
export function CarFoto({ c, url, lg, sm }) {
  return (
    <span className={`cfoto${lg ? ' lg' : ''}${sm ? ' sm' : ''}${url ? '' : ' leeg'}`} aria-hidden={url ? undefined : true}>
      {url ? <img src={url} alt={`Foto ${[c.merk, c.model, c.type].filter(Boolean).join(' ')}`} loading="lazy" />
        : <svg viewBox="0 0 24 24" width="40%" height="40%" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15l2-5a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 10l2 5v3h-2.5M5.5 18H3v-3m5.5 3h7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>}
    </span>
  );
}

// Link naar de map met documentatie van een auto (SharePoint, OneDrive, Google Drive, Dropbox ...)
export const isWebLink = (s) => /^https?:\/\/\S/i.test(String(s || '').trim());
export function DocLink({ c, edit }) {
  const { act } = useApp();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(c.doc_link || '');
  const [over, setOver] = useState(false);
  const [melding, setMelding] = useState('');
  useEffect(() => { setV(c.doc_link || ''); setOpen(false); setMelding(''); }, [c.id, c.doc_link]);
  const pad = /^(\\\\|[a-z]:\\|file:)/i.test(v.trim());
  const opslaan = async (link) => {
    const s = String(link || '').trim().replace(/ /g, '%20'); // spaties uit mapnamen veilig maken
    if (s && !isWebLink(s)) return false;
    return act((db) => db.update('autos', c.id, { doc_link: s || null }), s ? 'Link opgeslagen' : 'Link verwijderd', ['autos']);
  };
  const save = async (e) => { e.preventDefault(); if (await opslaan(v)) setOpen(false); };
  // Slepen: een link uit de adresbalk of van een webpagina komt binnen als text/uri-list of tekst
  const drop = async (e) => {
    e.preventDefault(); setOver(false); setMelding('');
    const dt = e.dataTransfer;
    const link = (dt.getData('text/uri-list') || '').split(/\r?\n/).find((l) => l && !l.startsWith('#')) || dt.getData('text/plain') || '';
    if (isWebLink(link)) { if (await opslaan(link.trim())) setOpen(false); return; }
    if (dt.files && dt.files.length) { setMelding('Je sleept een bestand of map van je computer. Open de map in SharePoint, OneDrive of Google Drive in de browser en sleep het adres uit de adresbalk hierheen.'); return; }
    setMelding(link ? 'Dit is geen weblink. Sleep het adres uit de adresbalk van de browser (begint met https://).' : 'Er kwam geen link mee. Sleep het adres uit de adresbalk van de browser.');
  };
  const sleep = edit ? {
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; if (!over) setOver(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); },
    onDrop: drop,
  } : {};
  if (open) return (
    <form className="doclink-f" onSubmit={save} {...sleep}>
      <input className="in" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Plak of sleep hier de link naar de map (https://…)" aria-label="Link naar documentatie" />
      <button className="btn primary sm" disabled={!!v.trim() && !isWebLink(v)}>Opslaan</button>
      <button type="button" className="btn ghost sm" onClick={() => { setV(c.doc_link || ''); setOpen(false); }}>Annuleren</button>
      {v.trim() && !isWebLink(v) && <p className="hint bad">{pad ? 'Dit is een pad op een server of computer. Dat kan een browser niet openen. Gebruik de deellink van SharePoint, OneDrive, Google Drive of Dropbox.' : 'Een link begint met https://'}</p>}
    </form>
  );
  if (!c.doc_link && edit) return (
    <div className={`dropvak${over ? ' over' : ''}`} {...sleep}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 10v6M9 13l3 3 3-3" /></svg>
      <div><b>{over ? 'Laat los om te koppelen' : 'Sleep de link naar de documentatiemap hierheen'}</b>
        <small>Open de map in de browser en sleep het adres uit de adresbalk in dit vak. <button className="linkish" onClick={() => setOpen(true)}>Of plak de link</button></small>
        {melding && <small className="bad">{melding}</small>}</div>
    </div>
  );
  return (
    <div className={`doclink${over ? ' over' : ''}`} {...sleep}>
      {c.doc_link
        ? <a className="btn" href={c.doc_link} target="_blank" rel="noreferrer noopener">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
            Documentatie openen</a>
        : <span className="note">Geen documentatie gekoppeld.</span>}
      {edit && <button className="btn ghost sm" onClick={() => setOpen(true)}>Link wijzigen</button>}
      {edit && <span className="hint">{over ? 'Laat los om de link te vervangen' : 'of sleep een nieuwe link hierheen'}</span>}
      {melding && <p className="hint bad">{melding}</p>}
    </div>
  );
}

export const Empty = ({ title, children }) => <div className="empty"><h2>{title}</h2>{children && <p>{children}</p>}</div>;

// Klein formulier-hulpje: houdt een object met velden bij
export function useForm(init) {
  const [f, setF] = useState(init);
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v && v.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));
  return [f, set, setF];
}
