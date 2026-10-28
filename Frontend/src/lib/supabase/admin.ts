import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { publicEnv, serverEnv } from '@/lib/env'

/**
 * Service-role client: bypasses RLS. Import ONLY from admin server actions and the
 * auth gates (login lockout / reset e-mail limits). Never from a client component.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
