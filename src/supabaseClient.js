import { createClient } from "@supabase/supabase-js";

// These are read from environment variables (set in .env for local dev,
// and in Netlify's Site Settings > Environment Variables for production).
// Never hardcode the actual values here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase environment variables. Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file (local) or Netlify environment variables (production)."
  );
}

/* Tells us how the current page load happened: a genuine browser refresh
   ("reload") vs. anything else — a fresh link click, typing the URL,
   Back/Forward, a new tab, coming back later ("navigate" / "back_forward").
   Defaults to "not a reload" if the browser can't tell us, since forcing a
   login in an unknown case is the safe direction, not the risky one. */
function isGenuineReload() {
  try {
    const entries = performance.getEntriesByType("navigation");
    if (entries && entries.length > 0 && entries[0].type) {
      return entries[0].type === "reload";
    }
  } catch {}
  try {
    if (window.performance && window.performance.navigation) {
      return window.performance.navigation.type === 1;
    }
  } catch {}
  return false;
}

/* This MUST run before createClient() below. Supabase's own persisted
   auth token lives in sessionStorage under its own key (separate from our
   app's "ovrams_session" marker), and the client reads it as soon as it's
   constructed. If we wiped it only afterwards (e.g. from a React
   useEffect), other code — like the signup-confirmation check in
   AuthGate, which legitimately needs to call getSession() — could read
   the still-present token first and silently restore the login before our
   cleanup ever runs. Clearing it here, synchronously, before the client
   exists, closes that race off entirely. */
if (!isGenuineReload()) {
  try {
    Object.keys(window.sessionStorage).forEach((key) => {
      if (key === "ovrams_session" || key.startsWith("sb-")) {
        window.sessionStorage.removeItem(key);
      }
    });
  } catch {}
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Stored in sessionStorage (not localStorage) so the underlying auth
    // token can survive a genuine page refresh. The cleanup above is what
    // actually prevents it from surviving anything else — this alone
    // would not be enough.
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
