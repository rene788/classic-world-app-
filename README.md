# Classics World Werkplaats

Interne webapp van Classics World voor de voorraad, dossiers per voorraadnummer, taken, uren, klanten en bestellingen.
De app draait in de browser en bewaart alles in Supabase (database, inlog en opslag voor foto's en facturen).

## Wat staat waar

| Map | Inhoud |
|---|---|
| `web/` | De app zelf (React + Vite) |
| `web/src/views/` | De schermen: Overzicht, Voorraad, Dossier, Mijn werk, Uren, Klanten, Bestellingen, Aanbod, Beheer |
| `web/src/config.js` | Adres van het Supabase-project en de publishable key |
| `supabase/01_database.sql` | Tabellen, rollen en beveiliging van de database |
| `supabase/test/` | Test die per rol controleert wie wat mag zien en wijzigen |

## De app bouwen

Nodig: [Node.js](https://nodejs.org) versie 20 of nieuwer.

```bash
cd web
npm ci          # pakketten installeren (eenmalig, of na een wijziging in package.json)
npm run build   # maakt de map web/dist
```

De map `web/dist` is de complete app. Zet die online, bijvoorbeeld door hem in Netlify te slepen
(project openen → **Deploys** → map in het vak slepen).

Andere opdrachten in `web/`:

```bash
npm run dev     # app lokaal openen op http://localhost:5173, gekoppeld aan de echte database
npm run lint    # code controleren op fouten
MOCK=1 npm run dev   # app openen met nep-gegevens, zonder Supabase
```

Met `MOCK=1` kies je de rol via de adresbalk: `?rol=beheerder`, `?rol=verkoop`, `?rol=monteur` of `?rol=meekijker`.

## Database

`supabase/01_database.sql` plak je in Supabase onder **SQL Editor → New query** en voer je uit met **Run**.
Het script kan veilig opnieuw worden uitgevoerd; bestaande gegevens blijven staan.
De waarschuwing over "destructive operations" komt doordat het script zijn eigen beveiligingsregels
eerst verwijdert en dan opnieuw aanmaakt.

De beveiliging testen zonder Supabase:

```bash
cd supabase/test
npm install
npm test        # verwacht: 38 geslaagd, 0 mislukt
```

## Rollen

| Rol | Mag |
|---|---|
| Beheerder | Alles, ook rollen, uurtarieven en uren goedkeuren of wijzigen |
| Verkoop | Auto's, prijzen, marge, klanten, matches, aanbod en bestellingen |
| Monteur | Taken, onderdelen, foto's en eigen uren melden; ziet geen prijzen, klanten of facturen |
| Meekijker | Alleen auto's, taken en foto's bekijken |
| Geblokkeerd | Geen toegang (gegevens blijven bewaard) |

Het eerste account dat in Supabase wordt aangemaakt wordt automatisch beheerder. Nieuwe accounts zijn meekijker
tot de beheerder in de app bij **Beheer** een rol kiest.

## Over de key in `config.js`

De publishable key van Supabase is bedoeld om in de app te staan en is geen geheim.
De gegevens worden beschermd door de inlog en de regels in `01_database.sql`.
Zet nooit de **secret** of **service_role** key in deze opslagplaats.
