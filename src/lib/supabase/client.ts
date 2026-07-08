import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkydkbuodikttfeawqsw.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-here'

// Safe client creation. If keys are placeholder or package has issues in static export,
// we fall back to a no-op client so the rest of the app (Overview, Codex, Controls UI) still renders.
// Real sync features only activate when real keys + auth are present.
let supabase: any

try {
  supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
} catch (e) {
  // Provide a dummy client that never throws on the methods we use.
  // All .from().select() etc will be no-ops or return empty in the calling code (which already has catches).
  console.warn('[supabase] createBrowserClient failed, running local-only mode', e)
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInAnonymously: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
      insert: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  }
}

export { supabase }
export type SupabaseClient = typeof supabase
