import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

const db = new PGlite();
const sql = fs.readFileSync(new URL('../01_database.sql', import.meta.url), 'utf8');

// Minimale nabootsing van Supabase: auth, storage, rollen, realtime-publicatie
await db.exec(`
create role authenticated; create role anon;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key, name text, public bool);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
alter table storage.objects enable row level security;
create publication supabase_realtime;
`);

await db.exec(sql);
await db.exec(sql); // tweede keer: moet ook goed gaan
await db.exec(`
grant usage on schema public, auth, storage to authenticated;
grant all on all tables in schema public to authenticated;
grant select, insert, delete on storage.objects to authenticated;
`);

const ids = { beh: '11111111-1111-1111-1111-111111111111', mon: '22222222-2222-2222-2222-222222222222', ver: '33333333-3333-3333-3333-333333333333', kijk: '44444444-4444-4444-4444-444444444444' };
for (const [k, id] of Object.entries(ids)) await db.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)`, [id, k + '@classics-world.test', JSON.stringify({ naam: k })]);

let pass = 0, fail = 0;
const as = async (who, q, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${ids[who]}',false); set role authenticated;`);
  try { const r = await db.query(q, params); return { ok: true, rows: r.rows, n: r.affectedRows }; }
  catch (e) { return { ok: false, err: e.message }; }
  finally { await db.exec('reset role'); }
};
const expect = (name, cond, info) => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FOUT', name, JSON.stringify(info)); } };

const rollen = (await db.query(`select naam, rol from public.profielen order by naam`)).rows;
expect('eerste account is beheerder, rest meekijker', rollen.find(r => r.naam === 'beh').rol === 'beheerder' && rollen.filter(r => r.rol === 'meekijker').length === 3, rollen);

let r;
r = await as('mon', `update public.profielen set rol='beheerder' where id=$1`, [ids.mon]);
expect('meekijker kan zichzelf geen rol geven', !r.ok, r);
r = await as('beh', `update public.profielen set rol='monteur' where id=$1`, [ids.mon]);
expect('beheerder maakt monteur', r.ok && r.n === 1, r);
r = await as('beh', `update public.profielen set rol='verkoop' where id=$1`, [ids.ver]);
expect('beheerder maakt verkoop', r.ok && r.n === 1, r);
r = await as('beh', `update public.profielen set rol='monteur' where id=$1`, [ids.beh]);
expect('laatste beheerder kan zich niet degraderen', !r.ok, r);
r = await as('mon', `update public.profielen set naam='Jan' where id=$1`, [ids.mon]);
expect('monteur past eigen naam aan', r.ok && r.n === 1, r);

// Auto's
r = await as('ver', `insert into public.autos(voorraadnr, chassisnr, merk, model) values ('2026-001','WP0ZZZ99ZTS312345','Porsche','993 Carrera') returning id`);
expect('verkoop voegt auto toe', r.ok, r);
const auto = r.rows[0].id;
r = await as('ver', `insert into public.auto_financien(auto_id, inkoopprijs, vraagprijs) values ($1, 80000, 115000)`, [auto]);
expect('verkoop zet inkoop/vraagprijs', r.ok, r);
r = await as('mon', `insert into public.autos(merk) values ('Fiat')`);
expect('monteur kan geen auto toevoegen', !r.ok, r);
r = await as('mon', `select * from public.autos`);
expect('monteur ziet de auto', r.ok && r.rows.length === 1, r);
r = await as('mon', `select * from public.auto_financien`);
expect('monteur ziet GEEN prijzen', r.ok && r.rows.length === 0, r);
r = await as('kijk', `select * from public.auto_financien`);
expect('meekijker ziet GEEN prijzen', r.ok && r.rows.length === 0, r);
r = await as('mon', `select * from public.klanten`);
expect('monteur ziet geen klanten', r.ok && r.rows.length === 0, r);

// Taken
r = await as('mon', `insert into public.taken(auto_id, tekst) values ($1,'Remmen nalopen') returning id`, [auto]);
expect('monteur voegt taak toe', r.ok, r);
r = await as('mon', `update public.taken set klaar=true`);
expect('monteur vinkt taak af', r.ok && r.n === 1, r);
r = await as('kijk', `insert into public.taken(auto_id, tekst) values ($1,'x')`, [auto]);
expect('meekijker kan geen taak toevoegen', !r.ok, r);

// Uren
r = await as('mon', `insert into public.uren(auto_id, monteur_id, uren) values ($1,$2,3.5)`, [auto, ids.mon]);
expect('monteur meldt eigen uren', r.ok, r);
r = await as('mon', `insert into public.uren(auto_id, monteur_id, uren, status) values ($1,$2,2,'goedgekeurd')`, [auto, ids.mon]);
expect('monteur kan uren niet zelf goedkeuren', !r.ok, r);
r = await as('mon', `insert into public.uren(auto_id, monteur_id, uren) values ($1,$2,2)`, [auto, ids.ver]);
expect('monteur kan geen uren voor een ander melden', !r.ok, r);
r = await as('mon', `update public.uren set uren=8`);
expect('monteur kan eigen uren niet wijzigen', r.ok && r.n === 0, r);
r = await as('mon', `delete from public.uren`);
expect('monteur kan eigen uren niet verwijderen', r.ok && r.n === 0, r);
r = await as('beh', `insert into public.uren(auto_id, monteur_id, uren, status) values ($1,$2,1,'goedgekeurd')`, [auto, ids.ver]);
r = await as('mon', `select * from public.uren`);
expect('monteur ziet alleen eigen uren', r.ok && r.rows.length === 1, r);
r = await as('beh', `update public.uren set status='goedgekeurd' where monteur_id=$1`, [ids.mon]);
expect('beheerder keurt uren goed', r.ok && r.n === 1, r);
r = await as('ver', `update public.uren set uren=1`);
expect('verkoop kan uren niet wijzigen', r.ok && r.n === 0, r);

// Klok
r = await as('mon', `insert into public.klokken(monteur_id, auto_id) values ($1,$2)`, [ids.mon, auto]);
expect('monteur start eigen klok', r.ok, r);
r = await as('mon', `delete from public.klokken where monteur_id=$1`, [ids.mon]);
expect('monteur stopt eigen klok', r.ok && r.n === 1, r);

// Media en opslag
r = await as('mon', `insert into public.media(auto_id, fase, pad) values ($1,'restauratie','fotos/a.jpg')`, [auto]);
expect('monteur voegt foto toe', r.ok, r);
r = await as('mon', `insert into public.media(auto_id, fase, pad) values ($1,'document','geld/f.pdf')`, [auto]);
expect('monteur kan geen document toevoegen', !r.ok, r);
await as('ver', `insert into public.media(auto_id, fase, pad) values ($1,'document','geld/factuur.pdf')`, [auto]);
r = await as('mon', `select fase from public.media`);
expect('monteur ziet foto maar geen factuur', r.ok && r.rows.length === 1 && r.rows[0].fase === 'restauratie', r);
r = await as('mon', `insert into storage.objects(bucket_id, name, owner_id) values ('media','fotos/b.jpg',$1)`, [ids.mon]);
expect('monteur uploadt foto-bestand', r.ok, r);
r = await as('mon', `insert into storage.objects(bucket_id, name, owner_id) values ('media','geld/c.pdf',$1)`, [ids.mon]);
expect('monteur kan niet in geld/ uploaden', !r.ok, r);
await as('ver', `insert into storage.objects(bucket_id, name, owner_id) values ('media','geld/d.pdf',$1)`, [ids.ver]);
r = await as('mon', `select name from storage.objects`);
expect('monteur ziet geen bestanden in geld/', r.ok && r.rows.every(x => !x.name.startsWith('geld/')), r);
r = await as('ver', `select name from storage.objects`);
expect('verkoop ziet alle bestanden', r.ok && r.rows.length === 2, r);

// Instellingen
r = await as('ver', `update public.instellingen set waarde='75' where sleutel='uurtarief'`);
expect('verkoop kan uurtarief niet wijzigen', r.ok && r.n === 0, r);
r = await as('beh', `update public.instellingen set waarde='75' where sleutel='uurtarief'`);
expect('beheerder zet uurtarief', r.ok && r.n === 1, r);
r = await as('mon', `select * from public.instellingen`);
expect('monteur ziet geen uurtarief', r.ok && r.rows.length === 0, r);

// Geblokkeerd
await as('beh', `update public.profielen set rol='geblokkeerd' where id=$1`, [ids.kijk]);
r = await as('kijk', `select * from public.autos`);
expect('geblokkeerd account ziet niets', r.ok && r.rows.length === 0, r);

const pub = (await db.query(`select count(*)::int n from pg_publication_tables where pubname='supabase_realtime'`)).rows[0].n;
expect('live bijwerken aan voor 16 tabellen', pub === 16, pub);

console.log(`\n${pass} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
