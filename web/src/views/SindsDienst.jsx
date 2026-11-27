import { useApp, Empty } from '../ui';
import { carLabel } from '../lib';
import { naamVan } from './Planning';

// Wat is er per auto veranderd sinds je er voor het laatst naar keek?
// Wijzigingen van anderen, nieuwer dan je "Gezien" per auto (of de laatste 7 dagen als je nog niets hebt afgevinkt).
const STANDAARD_DAGEN = 7;

export function ongezien(d, uid) {
  const gezien = Object.fromEntries((d.gezien || []).map((g) => [g.auto_id, g.tot]));
  const vanaf = new Date(Date.now() - STANDAARD_DAGEN * 864e5).toISOString();
  const per = new Map();
  for (const w of d.wijzigingen || []) {
    if (w.wie === uid || !d.autoById[w.auto_id]) continue;
    if (w.aangemaakt <= (gezien[w.auto_id] || vanaf)) continue;
    if (!per.has(w.auto_id)) per.set(w.auto_id, []);
    per.get(w.auto_id).push(w);
  }
  return [...per.entries()]
    .map(([id, ws]) => ({ c: d.autoById[id], ws: ws.sort((a, b) => b.aangemaakt.localeCompare(a.aangemaakt)) }))
    .sort((a, b) => b.ws[0].aangemaakt.localeCompare(a.ws[0].aangemaakt));
}

const dag = (iso) => new Date(iso).toLocaleDateString('nl-NL', { weekday: 'long' });
const tijd = (iso) => {
  const t = new Date(iso);
  const vandaag = new Date().toDateString() === t.toDateString();
  return vandaag ? `vandaag ${t.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
    : t.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + t.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
};

export default function SindsDienst() {
  const { d, act, uid, me, openCar } = useApp();
  const lijst = ongezien(d, uid);
  const eerste = lijst.length ? lijst.reduce((m, x) => (x.ws[x.ws.length - 1].aangemaakt < m ? x.ws[x.ws.length - 1].aangemaakt : m), lijst[0].ws[0].aangemaakt) : null;
  const zie = (ids) => act(async (db) => {
    const nu = new Date().toISOString();
    for (const id of ids) await db.upsert('gezien', { profiel_id: uid, auto_id: id, tot: nu });
  }, ids.length > 1 ? 'Alles gezien' : null, ['gezien']);

  return (
    <div className="sinds">
      <div className="sinds-kop">
        <div>
          <div className="eyebrow">Overdracht</div>
          <h2 className="vt">Welkom terug{me?.naam ? `, ${me.naam.split(' ')[0]}` : ''}{eerste ? ` — sinds ${dag(eerste)}` : ''}</h2>
          <p className="note" style={{ margin: '4px 0 0' }}>
            {lijst.length ? `${lijst.length} auto${lijst.length === 1 ? '' : "'s"} met wijzigingen van collega's. Vink af wat je hebt gezien.` : 'Wijzigingen van collega\'s aan auto\'s verschijnen hier.'}
          </p>
        </div>
        {lijst.length > 1 && <button className="btn" onClick={() => zie(lijst.map((x) => x.c.id))}>Alles gezien</button>}
      </div>
      {!lijst.length ? <div className="pane"><Empty title="Je bent helemaal bij">Er is niets veranderd sinds je laatste bezoek.</Empty></div> : (
        <div className="stack">
          {lijst.map(({ c, ws }) => (
            <section key={c.id} className="sinds-k">
              <div className="sinds-h">
                <button className="linkish" onClick={() => openCar(c.id)}>{carLabel(c)}{c.bouwjaar ? ` ${c.bouwjaar}` : ''}</button>
                <span className="note">{ws.length} wijziging{ws.length === 1 ? '' : 'en'}</span>
                <button className="btn sm" onClick={() => zie([c.id])}>✓ Gezien</button>
              </div>
              <ul className="sinds-l">
                {ws.map((w) => (
                  <li key={w.id}>
                    <span className="sinds-t">{tijd(w.aangemaakt)}</span>
                    <span className="sinds-w"><b>{naamVan(d, w.wie) || 'Iemand'}</b> · {w.tekst}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
