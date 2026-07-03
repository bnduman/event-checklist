/* ============================================================================
   Live team sync (optional)
   ----------------------------------------------------------------------------
   Leave these blank and the app runs in single-browser mode (edits stay on the
   device that made them).

   To let your whole team edit ONE shared copy that updates live, create a free
   Supabase project and paste its values below. Full step-by-step in
   SUPABASE_SETUP.md.

     SUPABASE_URL       -> Supabase → Project Settings → API → "Project URL"
     SUPABASE_ANON_KEY  -> same page → "Project API keys" → the "anon public" key

   The anon key is meant to live in front-end code; access is governed by the
   table's Row Level Security policy from the setup SQL.
   ============================================================================ */
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  TABLE: "checklist",   // table name from SUPABASE_SETUP.md (change only if you renamed it)
};
