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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Stored in sessionStorage (not localStorage) so the underlying auth
    // token can survive a genuine page refresh — but the app itself
    // decides, on every load, whether that stored token should actually
    // be trusted (see the navigation-type check in OVRAMS.jsx). A plain
    // reload keeps it; any other way of arriving at the page clears it
    // first, so this alone does not silently keep someone logged in.
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
