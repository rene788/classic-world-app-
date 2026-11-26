import { useEffect, useState } from 'react';
import { useApp, Sel, Field } from '../ui';
import { ROLLEN, fmtD, numDec, eur2 } from '../lib';
import { SUPABASE_URL } from '../config';

const RECHTEN = [
  ['Auto\'s bekijken', 1, 1, 1, 1], ['Auto\'s toevoegen en wijzigen', 1, 1, 0, 0], ['Taken, onderdelen en foto\'s', 1, 1, 1, 0],
  ['Eigen uren melden', 1, 1, 1, 0], ['Uren goedkeuren en wijzigen', 1, 0, 0, 0], ['Prijzen, marge, kosten, facturen', 1, 1, 0, 0],
  ['Klanten, matches en aanbod', 1, 1, 0, 0], ['Rollen en uurtarieven', 1, 0, 0, 0],
];

export default function Beheer() {
  const { d, act, uid } = useApp();
  const ref = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];
  const users = [...d.profielen].sort((a, b) => (a.naam || a.email || '').localeCompare(b.naam || b.email || '', 'nl'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="box">
        <h2>Gebruikers <span className="count num">{users.length}</span></h2>
        <div className="tw"><table>
          <thead><tr><th>Naam</th><th>E-mail</th><th>Rol</th><th>Sinds</th></tr></thead>
          <tbody>{users.map((p) => (
            <tr key={p.id}>
              <td><NaamVeld p={p} /></td>
              <td className="mono">{p.email}</td>
              <td><Sel value={p.rol} onChange={(v) => act((db) => db.update('profielen', p.id, { rol: v }), 'Rol aangepast', ['profielen'])} options={ROLLEN} aria-label={`Rol van ${p.naam || p.email}`} />
                {p.id === uid && <span className="note"> (jij)</span>}</td>
              <td>{fmtD(p.aangemaakt)}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b>Nieuwe collega toevoegen</b>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Open <a href={`https://supabase.com/dashboard/project/${ref}/auth/users`} target="_blank" rel="noreferrer">Gebruikers in Supabase</a> en klik op <b>Add user → Create new user</b>.</li>
            <li>Vul het e-mailadres en een tijdelijk wachtwoord in, vink <b>Auto Confirm User</b> aan.</li>
            <li>De collega verschijnt hier als <b>Geblokkeerd</b> en ziet nog niets. Kies de juiste rol en pas de naam aan.</li>
            <li>Geef de collega het wachtwoord door. Een eigen wachtwoord kiezen kan via "Wachtwoord vergeten?" op de inlogpagina.</li>
          </ol>
          <p className="hint">Iemand uit dienst? Zet de rol op <b>Geblokkeerd</b>; de gegevens en uren blijven bewaard.</p>
        </div>
      </section>

      <Tarieven />

      <section className="box">
        <h2>Wie mag wat</h2>
        <div className="tw"><table>
          <thead><tr><th /><th>Beheerder</th><th>Verkoop</th><th>Monteur</th><th>Meekijker</th></tr></thead>
          <tbody>{RECHTEN.map(([l, ...r]) => <tr key={l}><td>{l}</td>{r.map((x, i) => <td key={i} style={{ color: x ? 'var(--ok)' : 'var(--muted)', fontWeight: 700 }}>{x ? '✓' : '—'}</td>)}</tr>)}</tbody>
        </table></div>
        <p className="hint" style={{ marginTop: 6 }}>Monteurs zien hun eigen uren alleen; gemelde uren wachten op goedkeuring door de beheerder.</p>
      </section>
    </div>
  );
}

function NaamVeld({ p }) {
  const { act } = useApp();
  const [v, setV] = useState(p.naam || '');
  useEffect(() => setV(p.naam || ''), [p.naam]);
  return <input className="in" style={{ minWidth: 140 }} value={v} onChange={(e) => setV(e.target.value)} aria-label="Naam"
    onBlur={() => { if (v.trim() && v.trim() !== p.naam) act((db) => db.update('profielen', p.id, { naam: v.trim() }), 'Naam opgeslagen', ['profielen']); }} />;
}

function Tarieven() {
  const { d, act } = useApp();
  const [t, setT] = useState(String(d.settings.uurtarief ?? 0).replace('.', ','));
  const [tk, setTk] = useState(String(d.settings.uurtarief_klant ?? 0).replace('.', ','));
  const save = () => act(async (db) => {
    await db.upsert('instellingen', { sleutel: 'uurtarief', waarde: numDec(t) || 0 });
    await db.upsert('instellingen', { sleutel: 'uurtarief_klant', waarde: numDec(tk) || 0 });
  }, 'Tarieven opgeslagen', ['instellingen']);
  return (
    <section className="box">
      <h2>Uurtarieven</h2>
      <div className="grid2" style={{ maxWidth: 520 }}>
        <Field label="Intern uurtarief (kostprijs per uur)"><input className="in" inputMode="decimal" value={t} onChange={(e) => setT(e.target.value)} /></Field>
        <Field label="Uurtarief voor klanten"><input className="in" inputMode="decimal" value={tk} onChange={(e) => setTk(e.target.value)} /></Field>
      </div>
      <p className="hint" style={{ margin: '6px 0 10px' }}>Het interne tarief telt mee in de kosten per auto ({eur2(numDec(t) || 0)} per uur). Uren gemarkeerd als "voor de klant" worden met het klanttarief doorberekend.</p>
      <button className="btn primary" onClick={save}>Opslaan</button>
    </section>
  );
}
