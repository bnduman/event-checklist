/* ============================================================================
   auth.js — optional shared-password gate (client-side, WebCrypto)

   Dormant unless config.js AUTH.salt + AUTH.check are set — generate those with
   setup-password.html. When set, a lock screen covers the app until the correct
   password is entered. The password derives an AES key (PBKDF2) that decrypts a
   sentinel to verify it, and — if you protected the Supabase key — decrypts that
   key so live sync can connect.

   Honest scope: this keeps casual/public visitors out. Because it runs in the
   browser, a determined technical person could read the page source to bypass
   the *UI* gate. What it genuinely protects is the Supabase key (and therefore
   the shared data): that's stored only in encrypted form, so without the
   password it can't be recovered.
   ============================================================================ */
(() => {
  "use strict";
  const cfg = window.APP_CONFIG || {};
  const AUTH = cfg.AUTH || {};
  const enabled = !!(AUTH.salt && AUTH.check);
  const SENTINEL = "event-checklist-unlock-ok";
  const SESSION_KEY = "ec-pw";

  let resolveUnlock;
  const unlockPromise = new Promise((r) => (resolveUnlock = r));

  // Bridge the rest of the app talks to (sync.js awaits whenUnlocked()).
  window.Auth = {
    enabled,
    unlocked: !enabled,
    whenUnlocked: () =>
      enabled
        ? unlockPromise
        : Promise.resolve({ supabaseKey: (cfg.SUPABASE_ANON_KEY || "").trim() }),
  };

  if (!enabled) return;

  // ---- crypto helpers ----
  const te = new TextEncoder();
  const td = new TextDecoder();
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  async function decryptStr(key, b64) {
    const bytes = b64ToBytes(b64);
    const iv = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    return td.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  }

  // ---- lock screen ----
  const overlay = document.getElementById("lockScreen");
  const form = document.getElementById("lockForm");
  const input = document.getElementById("lockPassword");
  const errEl = document.getElementById("lockError");

  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => input.focus(), 40);

  async function tryPassword(password, fromSession) {
    errEl.textContent = "";
    let key;
    try {
      key = await deriveKey(password, b64ToBytes(AUTH.salt));
      const check = await decryptStr(key, AUTH.check);
      if (check !== SENTINEL) throw new Error("bad password");
    } catch (_) {
      if (fromSession) { sessionStorage.removeItem(SESSION_KEY); return; }
      errEl.textContent = "Incorrect password";
      input.value = "";
      input.focus();
      return;
    }

    // correct password → recover the Supabase key if it was protected
    let supabaseKey = (cfg.SUPABASE_ANON_KEY || "").trim();
    if (cfg.SUPABASE_ANON_KEY_ENC) {
      try { supabaseKey = (await decryptStr(key, cfg.SUPABASE_ANON_KEY_ENC)).trim(); } catch (_) {}
    }
    try { sessionStorage.setItem(SESSION_KEY, password); } catch (_) {}

    window.Auth.unlocked = true;
    overlay.hidden = true;
    document.body.style.overflow = "";
    resolveUnlock({ supabaseKey });
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); tryPassword(input.value, false); });

  // stay unlocked for the rest of this browser-tab session
  const remembered = sessionStorage.getItem(SESSION_KEY);
  if (remembered) tryPassword(remembered, true);
})();
