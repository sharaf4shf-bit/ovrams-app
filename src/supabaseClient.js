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
    // No persisted storage at all: the session lives only in memory for the
    // current page load. Refreshing the page, going back in browser history
    // and re-opening the link, or revisiting the site later always starts
    // at the login screen — nobody stays signed in across a full page load,
    // which matters for shared/kiosk computers where officers may forget to
    // log out.
    persistSession: false,
    autoRefreshToken: true,
  },
});
