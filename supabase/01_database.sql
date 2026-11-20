-- =====================================================================
-- Classics World Werkplaats — database-opzet (stap 1 van de nieuwe app)
-- Plak dit hele bestand in Supabase > SQL Editor > New query en klik Run.
-- Je kunt het veilig vaker uitvoeren: bestaande gegevens blijven staan.
-- =====================================================================

-- ---------- Gebruikers en rollen ----------
-- Rollen: beheerder (alles), verkoop (alles behalve rollen en tarieven),
-- monteur (taken, onderdelen, foto's, eigen uren melden; geen prijzen),
-- meekijker (alleen lezen, geen prijzen).

create table if not exists public.profielen (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  naam        text not null default '',
  rol         text not null default 'meekijker'
              check (rol in ('beheerder','verkoop','monteur','meekijker','geblokkeerd')),
  aangemaakt  timestamptz not null default now()
);

create or replace function public.mijn_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.profielen where id = auth.uid()
$$;
create or replace function public.is_beheerder() returns boolean
language sql stable as $$ select coalesce(public.mijn_rol() = 'beheerder', false) $$;
create or replace function public.ziet_geld() returns boolean
language sql stable as $$ select coalesce(public.mijn_rol() in ('beheerder','verkoop'), false) $$;
create or replace function public.mag_werken() returns boolean
language sql stable as $$ select coalesce(public.mijn_rol() in ('beheerder','verkoop','monteur'), false) $$;
create or replace function public.heeft_toegang() returns boolean
language sql stable as $$ select coalesce(public.mijn_rol() in ('beheerder','verkoop','monteur','meekijker'), false) $$;

-- Nieuw account: de allereerste gebruiker wordt beheerder, daarna is iedereen
-- meekijker tot de beheerder een rol geeft.
create or replace function public.nieuw_profiel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profielen (id, email, naam, rol)
  values (
    new.id, new.email,
    coalesce(nullif(new.raw_user_meta_data->>'naam',''), split_part(coalesce(new.email,''),'@',1)),
    case when exists (select 1 from public.profielen where rol = 'beheerder') then 'meekijker' else 'beheerder' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists bij_nieuw_account on auth.users;
create trigger bij_nieuw_account after insert on auth.users
  for each row execute function public.nieuw_profiel();

-- Er moet altijd minstens één beheerder overblijven.
create or replace function public.bewaak_beheerder() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE' and old.rol = 'beheerder') or (tg_op = 'UPDATE' and old.rol = 'beheerder' and new.rol <> 'beheerder') then
    if not exists (select 1 from public.profielen where rol = 'beheerder' and id <> old.id) then
      raise exception 'Er moet minstens één beheerder blijven.';
    end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists laatste_beheerder on public.profielen;
create trigger laatste_beheerder before update or delete on public.profielen
  for each row execute function public.bewaak_beheerder();

-- Alleen de beheerder mag rollen wijzigen; ieder mag de eigen naam aanpassen.
create or replace function public.bewaak_rol() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rol is distinct from old.rol and auth.uid() is not null and not public.is_beheerder() then
    raise exception 'Alleen de beheerder kan rollen wijzigen.';
  end if;
  return new;
end $$;
drop trigger if exists rol_wijzigen on public.profielen;
create trigger rol_wijzigen before update on public.profielen
  for each row execute function public.bewaak_rol();

-- Gewijzigd-op bijhouden
create or replace function public.zet_gewijzigd() returns trigger
language plpgsql as $$ begin new.gewijzigd = now(); return new; end $$;

-- ---------- Voorraad ----------
create table if not exists public.autos (
  id             uuid primary key default gen_random_uuid(),
  voorraadnr     text unique,
  chassisnr      text,
  kenteken       text,
  merk           text not null default '',
  model          text not null default '',
  type           text not null default '',
  bouwjaar       int,
  kleur          text,
  km             int,
  status         text not null default 'binnen' check (status in ('onderweg','binnen','werkplaats','klaar','verkocht','geannuleerd')),
  locatie        text check (locatie is null or locatie in ('werkplaats','showroom','loods','extern','box1','box2','box3','box4','box5','box6','box7','box8','box9','box10')),
  locatie_info   text,
  datum_binnen   date default current_date,
  verkoopdatum   date,
  bestemming     text check (bestemming is null or bestemming in ('nl','eu','buiten')),
  omschrijving   text,
  aangemaakt     timestamptz not null default now(),
  gewijzigd      timestamptz not null default now(),
  aangemaakt_door uuid default auth.uid()
);
create index if not exists autos_chassis on public.autos (chassisnr);
-- Profielfoto: pad naar een kleine JPEG in de opslag (map <auto-id>/profiel/)
alter table public.autos add column if not exists foto text;

-- Geld per auto: apart, zodat monteurs en meekijkers het nooit binnenkrijgen.
create table if not exists public.auto_financien (
  auto_id       uuid primary key references public.autos(id) on delete cascade,
  inkoopprijs   numeric(12,2),
  vraagprijs    numeric(12,2),
  verkoopprijs  numeric(12,2),
  regeling      text not null default 'marge' check (regeling in ('marge','btw')),
  notitie       text,
  gewijzigd     timestamptz not null default now()
);

create table if not exists public.taken (
  id          uuid primary key default gen_random_uuid(),
  auto_id     uuid not null references public.autos(id) on delete cascade,
  tekst       text not null,
  uitleg      text,
  monteur     text,
  klaar       boolean not null default false,
  klaar_door  uuid,
  klaar_op    timestamptz,
  volgorde    int not null default 0,
  aangemaakt  timestamptz not null default now()
);
create index if not exists taken_auto on public.taken (auto_id);

create table if not exists public.onderdelen (
  id          uuid primary key default gen_random_uuid(),
  auto_id     uuid not null references public.autos(id) on delete cascade,
  onderdeel   text not null,
  leverancier text,
  status      text not null default 'nodig' check (status in ('nodig','besteld','binnen')),
  verwacht    date,
  notitie     text,
  aangemaakt  timestamptz not null default now()
);
create index if not exists onderdelen_auto on public.onderdelen (auto_id);

-- Uren: een monteur meldt uren (status 'ingediend') en kan ze daarna niet zelf
-- wijzigen; de beheerder keurt goed of past aan. 'voor_klant' = kosten voor de klant.
create table if not exists public.uren (
  id           uuid primary key default gen_random_uuid(),
  auto_id      uuid references public.autos(id) on delete set null,
  monteur_id   uuid not null references public.profielen(id),
  datum        date not null default current_date,
  uren         numeric(5,2) not null check (uren > 0 and uren <= 24),
  omschrijving text,
  voor_klant   boolean not null default false,
  status       text not null default 'ingediend' check (status in ('ingediend','goedgekeurd')),
  aangemaakt   timestamptz not null default now()
);
create index if not exists uren_auto on public.uren (auto_id);
create index if not exists uren_monteur on public.uren (monteur_id, datum);

-- Lopende klok per monteur (één tegelijk)
create table if not exists public.klokken (
  monteur_id   uuid primary key references public.profielen(id) on delete cascade,
  auto_id      uuid references public.autos(id) on delete cascade,
  gestart_op   timestamptz not null default now(),
  omschrijving text,
  voor_klant   boolean not null default false
);

create table if not exists public.kosten (
  id           uuid primary key default gen_random_uuid(),
  auto_id      uuid not null references public.autos(id) on delete cascade,
  soort        text not null default 'overig' check (soort in ('derden','transport','keuring','onderdelen','overig')),
  omschrijving text,
  bedrag       numeric(12,2) not null,
  datum        date not null default current_date,
  aangemaakt   timestamptz not null default now()
);
create index if not exists kosten_auto on public.kosten (auto_id);

-- Bestellingen/facturen: met auto_id hoort het bij een voorraadnummer, zonder is het een losse bestelling.
create table if not exists public.bestellingen (
  id           uuid primary key default gen_random_uuid(),
  auto_id      uuid references public.autos(id) on delete set null,
  leverancier  text,
  omschrijving text,
  factuurnr    text,
  bedrag       numeric(12,2),
  datum        date not null default current_date,
  status       text not null default 'besteld' check (status in ('besteld','geleverd','betaald')),
  voor_klant   boolean not null default false,
  bestand      text,   -- pad in de opslag, altijd onder geld/
  aangemaakt   timestamptz not null default now()
);
create index if not exists bestellingen_auto on public.bestellingen (auto_id);

create table if not exists public.afleverlijst (
  id        uuid primary key default gen_random_uuid(),
  auto_id   uuid not null references public.autos(id) on delete cascade,
  tekst     text not null,
  klaar     boolean not null default false,
  volgorde  int not null default 0
);
create index if not exists afleverlijst_auto on public.afleverlijst (auto_id);

create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  auto_id     uuid references public.autos(id) on delete cascade,
  taak_id     uuid references public.taken(id) on delete cascade,
  fase        text not null default 'restauratie' check (fase in ('binnenkomst','restauratie','verkoop','aflevering','document')),
  pad         text not null,
  naam        text,
  soort       text,
  geupload_door uuid default auth.uid(),
  aangemaakt  timestamptz not null default now()
);
create index if not exists media_auto on public.media (auto_id);

create table if not exists public.boxen (
  locatie  text primary key,
  vol      boolean not null default false
);

-- ---------- Klanten en verkoop ----------
create table if not exists public.klanten (
  id          uuid primary key default gen_random_uuid(),
  naam        text not null,
  telefoon    text,
  email       text,
  plaats      text,
  land        text,
  notitie     text,
  aangemaakt  timestamptz not null default now(),
  gewijzigd   timestamptz not null default now()
);

create table if not exists public.zoekwensen (
  id         uuid primary key default gen_random_uuid(),
  klant_id   uuid not null references public.klanten(id) on delete cascade,
  merk       text,
  model      text,
  type       text,
  jaar_van   int,
  jaar_tot   int,
  max_prijs  numeric(12,2),
  notitie    text
);
create index if not exists zoekwensen_klant on public.zoekwensen (klant_id);

create table if not exists public.contactmomenten (
  id         uuid primary key default gen_random_uuid(),
  klant_id   uuid not null references public.klanten(id) on delete cascade,
  auto_id    uuid references public.autos(id) on delete set null,
  datum      date not null default current_date,
  kanaal     text,
  uitkomst   text check (uitkomst is null or uitkomst in ('geinformeerd','interesse','komt-kijken','proefrit','bod','te-duur','geen-interesse','gekocht')),
  afspraak   date,
  notitie    text,
  door       uuid default auth.uid(),
  aangemaakt timestamptz not null default now()
);
create index if not exists contact_klant on public.contactmomenten (klant_id);
create index if not exists contact_auto on public.contactmomenten (auto_id);

create table if not exists public.aanbod (
  id         uuid primary key default gen_random_uuid(),
  merk       text,
  model      text,
  type       text,
  bouwjaar   int,
  prijs      numeric(12,2),
  land       text,
  bron       text,
  link       text,
  status     text not null default 'nieuw' check (status in ('nieuw','interessant','afgewezen','ingekocht')),
  notitie    text,
  aangemaakt timestamptz not null default now()
);

create table if not exists public.instellingen (
  sleutel  text primary key,
  waarde   jsonb not null
);
insert into public.instellingen (sleutel, waarde) values
  ('uurtarief', '0'::jsonb), ('uurtarief_klant', '0'::jsonb)
on conflict (sleutel) do nothing;

-- Gewijzigd-triggers
drop trigger if exists gewijzigd on public.autos;
create trigger gewijzigd before update on public.autos for each row execute function public.zet_gewijzigd();
drop trigger if exists gewijzigd on public.auto_financien;
create trigger gewijzigd before update on public.auto_financien for each row execute function public.zet_gewijzigd();
drop trigger if exists gewijzigd on public.klanten;
create trigger gewijzigd before update on public.klanten for each row execute function public.zet_gewijzigd();

-- ---------- Beveiliging per rij (RLS) ----------
-- Status 'onderweg' (nov 2026): ook toepassen op een bestaande database
alter table public.autos drop constraint if exists autos_status_check;
alter table public.autos add constraint autos_status_check check (status in ('onderweg','binnen','werkplaats','klaar','verkocht','geannuleerd'));
-- Geannuleerde aankopen (nov 2026)
alter table public.autos add column if not exists geannuleerd_op date;
alter table public.autos add column if not exists annuleer_reden text;
-- Link naar de map met documentatie (SharePoint, OneDrive, Google Drive ...)
alter table public.autos add column if not exists doc_link text;
-- Consignatie (nov 2026): voorraadnummers 200 t/m 299 zijn altijd consignatie
alter table public.autos add column if not exists soort text not null default 'eigen';
alter table public.autos drop constraint if exists autos_soort_check;
alter table public.autos add constraint autos_soort_check check (soort in ('eigen','consignatie'));
create or replace function public.zet_soort() returns trigger language plpgsql set search_path = public as $$
begin
  if new.voorraadnr ~ '^[0-9]{4}-2[0-9]{2}$' then new.soort := 'consignatie'; end if;
  return new;
end $$;
drop trigger if exists zet_soort on public.autos;
create trigger zet_soort before insert or update of voorraadnr, soort on public.autos for each row execute function public.zet_soort();
alter table public.auto_financien add column if not exists cons_eigenaar uuid references public.klanten(id) on delete set null;
alter table public.auto_financien add column if not exists cons_afspraak text;
alter table public.auto_financien drop constraint if exists auto_financien_cons_afspraak_check;
alter table public.auto_financien add constraint auto_financien_cons_afspraak_check check (cons_afspraak is null or cons_afspraak in ('provisie_pct','provisie_bedrag','netto_eigenaar'));
alter table public.auto_financien add column if not exists cons_waarde numeric;
alter table public.auto_financien add column if not exists cons_tot date;
alter table public.auto_financien add column if not exists cons_afgerekend boolean not null default false;

alter table public.profielen        enable row level security;
alter table public.autos            enable row level security;
alter table public.auto_financien   enable row level security;
alter table public.taken            enable row level security;
alter table public.onderdelen       enable row level security;
alter table public.uren             enable row level security;
alter table public.klokken          enable row level security;
alter table public.kosten           enable row level security;
alter table public.bestellingen     enable row level security;
alter table public.afleverlijst     enable row level security;
alter table public.media            enable row level security;
alter table public.boxen            enable row level security;
alter table public.klanten          enable row level security;
alter table public.zoekwensen       enable row level security;
alter table public.contactmomenten  enable row level security;
alter table public.aanbod           enable row level security;
alter table public.instellingen     enable row level security;

-- Oude regels opruimen zodat het script herhaalbaar is
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Profielen: iedereen met toegang ziet namen; eigen profiel bijwerken; beheerder alles.
create policy lezen on public.profielen for select to authenticated using (id = auth.uid() or public.heeft_toegang());
create policy eigen_bijwerken on public.profielen for update to authenticated using (id = auth.uid() or public.is_beheerder()) with check (id = auth.uid() or public.is_beheerder());
create policy beheerder_verwijderen on public.profielen for delete to authenticated using (public.is_beheerder());

-- Auto's: iedereen leest; verkoop en beheerder wijzigen.
create policy lezen on public.autos for select to authenticated using (public.heeft_toegang());
create policy toevoegen on public.autos for insert to authenticated with check (public.ziet_geld());
create policy wijzigen on public.autos for update to authenticated using (public.ziet_geld()) with check (public.ziet_geld());
create policy verwijderen on public.autos for delete to authenticated using (public.is_beheerder());

-- Geld, klanten en aanbod: alleen verkoop en beheerder.
create policy geld on public.auto_financien  for all to authenticated using (public.ziet_geld()) with check (public.ziet_geld());
create policy geld on public.kosten          for all to authenticated using (public.ziet_geld()) with check (public.ziet_geld());
create policy geld on public.bestellingen    for all to authenticated using (public.ziet_geld()) with check (public.ziet_geld());
create policy geld on public.afleverlijst    for all to authenticated using (public.ziet_geld()) with check (public.ziet_geld());
create policy geld on public.klanten         for all to authenticated using (public.ziet_geld()) with check (public.ziet_geld());
create policy geld on public.zoekwensen      for all to authenticated using (public.ziet_geld()) with check (public.ziet_geld());
create policy geld on public.contactmomenten for all to authenticated using (public.ziet_geld()) with check (public.ziet_geld());
create policy geld on public.aanbod          for all to authenticated using (public.ziet_geld()) with check (public.ziet_geld());

-- Taken en onderdelen: iedereen leest, werkers voegen toe en vinken af, verkoop/beheerder verwijdert.
create policy lezen on public.taken for select to authenticated using (public.heeft_toegang());
create policy toevoegen on public.taken for insert to authenticated with check (public.mag_werken());
create policy wijzigen on public.taken for update to authenticated using (public.mag_werken()) with check (public.mag_werken());
create policy verwijderen on public.taken for delete to authenticated using (public.ziet_geld());

create policy lezen on public.onderdelen for select to authenticated using (public.heeft_toegang());
create policy toevoegen on public.onderdelen for insert to authenticated with check (public.mag_werken());
create policy wijzigen on public.onderdelen for update to authenticated using (public.mag_werken()) with check (public.mag_werken());
create policy verwijderen on public.onderdelen for delete to authenticated using (public.ziet_geld());

-- Uren: monteur ziet en meldt alleen eigen uren (als 'ingediend') en kan niets wijzigen.
create policy lezen on public.uren for select to authenticated using (public.ziet_geld() or (public.mag_werken() and monteur_id = auth.uid()));
create policy melden on public.uren for insert to authenticated with check (
  public.ziet_geld() or (public.mag_werken() and monteur_id = auth.uid() and status = 'ingediend'));
create policy wijzigen on public.uren for update to authenticated using (public.is_beheerder()) with check (public.is_beheerder());
create policy verwijderen on public.uren for delete to authenticated using (public.is_beheerder());

-- Klok: ieder beheert de eigen klok; verkoop/beheerder ziet alle lopende klokken.
create policy lezen on public.klokken for select to authenticated using (monteur_id = auth.uid() or public.ziet_geld());
create policy eigen on public.klokken for insert to authenticated with check (monteur_id = auth.uid() and public.mag_werken());
create policy eigen_wijzigen on public.klokken for update to authenticated using (monteur_id = auth.uid()) with check (monteur_id = auth.uid());
create policy eigen_stoppen on public.klokken for delete to authenticated using (monteur_id = auth.uid() or public.is_beheerder());

-- Foto's: iedereen ziet ze, werkers uploaden, eigenaar of beheerder verwijdert.
-- Documenten (fase 'document', bijv. facturen) zijn alleen voor verkoop en beheerder.
create policy lezen on public.media for select to authenticated using (
  public.ziet_geld() or (public.heeft_toegang() and fase <> 'document'));
create policy toevoegen on public.media for insert to authenticated with check (
  public.ziet_geld() or (public.mag_werken() and fase <> 'document'));
create policy verwijderen on public.media for delete to authenticated using (geupload_door = auth.uid() or public.is_beheerder());

-- Boxen: iedereen ziet, verkoop/beheerder zet op vol.
create policy lezen on public.boxen for select to authenticated using (public.heeft_toegang());
create policy wijzigen on public.boxen for all to authenticated using (public.ziet_geld()) with check (public.ziet_geld());

-- Instellingen (uurtarieven): verkoop/beheerder lezen, alleen beheerder wijzigt.
create policy lezen on public.instellingen for select to authenticated using (public.ziet_geld());
create policy wijzigen on public.instellingen for all to authenticated using (public.is_beheerder()) with check (public.is_beheerder());

-- ---------- Opslag voor foto's en facturen ----------
-- Bestanden onder 'geld/' (facturen, documenten) zijn alleen voor verkoop en beheerder.
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists "werkplaats lezen" on storage.objects;
drop policy if exists "werkplaats uploaden" on storage.objects;
drop policy if exists "werkplaats verwijderen" on storage.objects;
create policy "werkplaats lezen" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (public.ziet_geld() or (public.heeft_toegang() and name not like 'geld/%')));
create policy "werkplaats uploaden" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (public.ziet_geld() or (public.mag_werken() and name not like 'geld/%')));
create policy "werkplaats verwijderen" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (owner_id = auth.uid()::text or public.is_beheerder()));

-- ---------- Live bijwerken voor iedereen ----------
do $$ declare t text; begin
  foreach t in array array['autos','auto_financien','taken','onderdelen','uren','klokken','kosten','bestellingen',
                           'afleverlijst','media','boxen','klanten','zoekwensen','contactmomenten','aanbod','profielen'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Klaar. Controle: onderstaande regel toont alle tabellen met beveiliging aan.
select tablename, rowsecurity as beveiligd from pg_tables where schemaname = 'public' order by tablename;
