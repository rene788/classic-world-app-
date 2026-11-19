import { useState } from 'react';
import { db } from '../db';
import { errText } from '../lib';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [vergeten, setVergeten] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    try {
      if (vergeten) {
        await db.resetPassword(email.trim());
        setMsg('Als dit e-mailadres bekend is, ontvang je een e-mail met een link om een nieuw wachtwoord te kiezen.');
      } else {
        await db.signIn(email.trim(), pw);
      }
    } catch (e2) { setErr(errText(e2)); }
    setBusy(false);
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <h1>Classics World Werkplaats</h1>
        <p className="sub">{vergeten ? 'Vul je e-mailadres in voor een nieuw wachtwoord.' : 'Log in met je werkaccount.'}</p>
        {err && <div className="err" role="alert">{err}</div>}
        {msg && <div className="okmsg" role="status">{msg}</div>}
        <label className="f">E-mailadres
          <input className="in" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        {!vergeten && (
          <label className="f">Wachtwoord
            <input className="in" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
        )}
        <button className="btn primary lg" disabled={busy}>{busy ? 'Even geduld…' : vergeten ? 'Stuur link' : 'Inloggen'}</button>
        <button type="button" className="linkish" style={{ alignSelf: 'center' }} onClick={() => { setVergeten(!vergeten); setErr(''); setMsg(''); }}>
          {vergeten ? 'Terug naar inloggen' : 'Wachtwoord vergeten?'}
        </button>
        <p className="hint" style={{ textAlign: 'center' }}>Nog geen account? Vraag de beheerder om er een voor je aan te maken.</p>
      </form>
    </div>
  );
}

export function NieuwWachtwoord({ onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setErr('Kies een wachtwoord van minstens 8 tekens.');
    if (pw !== pw2) return setErr('De twee wachtwoorden zijn niet gelijk.');
    setBusy(true);
    try { await db.setPassword(pw); onDone(); } catch (e2) { setErr(errText(e2)); setBusy(false); }
  };
  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <h1>Nieuw wachtwoord</h1>
        {err && <div className="err" role="alert">{err}</div>}
        <label className="f">Nieuw wachtwoord<input className="in" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></label>
        <label className="f">Nog een keer<input className="in" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <button className="btn primary lg" disabled={busy}>Opslaan</button>
      </form>
    </div>
  );
}
