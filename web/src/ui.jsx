import { createContext, useContext, useEffect, useState } from 'react';
import { STL, LOCL } from './lib';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
  ? <span className="loc">{(LOCL[c.locatie] || c.locatie) + (c.locatie === 'extern' && c.locatie_info ? ': ' + c.locatie_info : '')}</span> : null;

export const Empty = ({ title, children }) => <div className="empty"><h2>{title}</h2>{children && <p>{children}</p>}</div>;

// Klein formulier-hulpje: houdt een object met velden bij
export function useForm(init) {
  const [f, setF] = useState(init);
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v && v.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));
  return [f, set, setF];
}
