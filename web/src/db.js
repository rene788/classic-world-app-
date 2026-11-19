// Alle communicatie met Supabase loopt via dit bestand.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const TABLES = ['profielen', 'autos', 'auto_financien', 'taken', 'onderdelen', 'uren', 'klokken', 'kosten',
  'bestellingen', 'afleverlijst', 'media', 'boxen', 'klanten', 'zoekwensen', 'contactmomenten', 'aanbod', 'instellingen'];
const KEYS = { auto_financien: 'auto_id', klokken: 'monteur_id', boxen: 'locatie', instellingen: 'sleutel' };
export const keyOf = (t) => KEYS[t] || 'id';

const check = ({ data, error }) => { if (error) throw error; return data; };
const denied = () => Object.assign(new Error('row-level security'), { code: '42501' });

export const db = {
  async session() { const { data } = await sb.auth.getSession(); return data.session; },
  onAuth(cb) { const { data } = sb.auth.onAuthStateChange((ev, s) => cb(ev, s)); return () => data.subscription.unsubscribe(); },
  async signIn(email, password) { return check(await sb.auth.signInWithPassword({ email, password })); },
  signOut: () => sb.auth.signOut(),
  async resetPassword(email) { check(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
  async setPassword(password) { check(await sb.auth.updateUser({ password })); },

  async all(t) {
    let out = [];
    for (let from = 0; ; from += 1000) {
      const rows = check(await sb.from(t).select('*').range(from, from + 999));
      out = out.concat(rows);
      if (rows.length < 1000) return out;
    }
  },
  async insert(t, row) { return check(await sb.from(t).insert(row).select().single()); },
  async insertMany(t, rows) { return check(await sb.from(t).insert(rows).select()); },
  async upsert(t, row) { return check(await sb.from(t).upsert(row).select().single()); },
  async update(t, id, patch) {
    const rows = check(await sb.from(t).update(patch).eq(keyOf(t), id).select());
    if (!rows.length) throw denied();
    return rows[0];
  },
  async remove(t, id) {
    const rows = check(await sb.from(t).delete().eq(keyOf(t), id).select());
    if (!rows.length) throw denied();
  },

  async upload(path, file) { check(await sb.storage.from('media').upload(path, file, { upsert: false, contentType: file.type })); return path; },
  async urls(paths) {
    if (!paths.length) return {};
    const data = check(await sb.storage.from('media').createSignedUrls(paths, 3600));
    const m = {};
    data.forEach((d) => { if (d.signedUrl) m[d.path] = d.signedUrl; });
    return m;
  },
  async removeFile(path) { check(await sb.storage.from('media').remove([path])); },

  live(onTable) {
    const ch = sb.channel('werkplaats')
      .on('postgres_changes', { event: '*', schema: 'public' }, (p) => onTable(p.table))
      .subscribe();
    return () => sb.removeChannel(ch);
  },
};
