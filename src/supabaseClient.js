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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
