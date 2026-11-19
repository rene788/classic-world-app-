// Verbinding met Supabase. De publishable key is bedoeld om in de app te staan;
// de gegevens zelf zijn beveiligd met de regels in supabase/01_database.sql.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ximltwatxogbittyzzba.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_CPPx-jgBeYtOZ4BNWi2Nbg_P0FKbjUS';
