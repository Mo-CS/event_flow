import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://vcmsdtighsmmwssyuese.supabase.co"
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbXNkdGlnaHNtbXdzc3l1ZXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTE5MTksImV4cCI6MjA5OTE4NzkxOX0.Y4kFTQYcyodvwWlBB2QOL-V9ShCs7EZ3Iryfap-Tgcg"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
