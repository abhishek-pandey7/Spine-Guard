import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://shvsoyvfqjhpznmwthwv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNodnNveXZmcWpocHpubXd0aHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODgzNjUsImV4cCI6MjA5MDg2NDM2NX0.mGtibOQKw58fJjCemm9KqKgm9qrMxe933o6NVkfnUHM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
