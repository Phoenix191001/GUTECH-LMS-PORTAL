import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { publicEnv } from '@/lib/env'

/** Browser client (cookie-based session). Used for Realtime and direct Storage uploads. */
export function createClient() {
  const env = publicEnv()
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
