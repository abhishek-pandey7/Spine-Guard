import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars — ensure VITE_SUPABASE_URL and VITE_SUPABASE_KEY are set in .env at the project root");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);