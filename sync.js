/* ============================================================================
   sync.js — optional live shared-data layer backed by Supabase.

   Loaded as a module AFTER app.js. If config.js has no Supabase credentials,
   this stays dormant and the app runs in single-browser mode. When credentials
   are present it:
     - loads the shared document on start (seeding it the first time),
     - pushes every local edit (debounced) to the shared row,
     - subscribes to realtime changes and applies teammates' edits live.

   The whole dataset is stored as one JSON document (last-write-wins). Realtime
   keeps everyone current, so for a small team conflicts are rare; two edits in
   the same second could still overwrite each other.
   ============================================================================ */
const cfg = window.APP_CONFIG || {};
const URL_ = (cfg.SUPABASE_URL || "").trim();
const KEY = (cfg.SUPABASE_ANON_KEY || "").trim();
const TABLE = (cfg.TABLE || "checklist").trim();
const ROW_ID = 1;
const clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);

function setStatus(state, text) {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.dataset.state = state;
  el.textContent = text;
  el.hidden = false;
}

// default: dormant, edits stay local
window.CloudSync = { enabled: false, push() {} };

if (!URL_ || !KEY) {
  setStatus("local", "Local only");
} else {
  boot();
}

async function boot() {
  setStatus("connecting", "Connecting…");

  let supabase;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(URL_, KEY);
  } catch (e) {
    console.error("[sync] could not load supabase-js:", e);
    setStatus("offline", "Sync unavailable");
    return;
  }

  const payloadOf = (data) => ({
    id: ROW_ID,
    data: { years: data },
    writer: clientId,
    updated_at: new Date().toISOString(),
  });

  let timer = null;
  window.CloudSync = {
    enabled: true,
    push(data) {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const { error } = await supabase.from(TABLE).upsert(payloadOf(data));
        if (error) { console.error("[sync] save failed:", error); setStatus("offline", "Sync error"); }
        else setStatus("live", "Live sync on");
      }, 400);
    },
  };

  // initial load — adopt the shared copy, or seed it if the table is empty
  try {
    const { data: row, error } = await supabase.from(TABLE).select("data").eq("id", ROW_ID).maybeSingle();
    if (error) throw error;
    if (row && row.data && row.data.years) {
      window.__applyRemoteData(row.data.years);
    } else {
      await supabase.from(TABLE).upsert(payloadOf(window.__getLocalData()));
    }
    setStatus("live", "Live sync on");
  } catch (e) {
    console.error("[sync] initial load failed:", e);
    setStatus("offline", "Sync error");
    // keep enabled so later edits still try to push
  }

  // realtime — apply other people's edits as they happen
  supabase
    .channel("checklist-sync")
    .on("postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `id=eq.${ROW_ID}` },
      (payload) => {
        const rec = payload.new;
        if (!rec || rec.writer === clientId) return; // ignore our own echo
        if (rec.data && rec.data.years) window.__applyRemoteData(rec.data.years);
      })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setStatus("live", "Live sync on");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStatus("offline", "Sync offline");
    });
}
