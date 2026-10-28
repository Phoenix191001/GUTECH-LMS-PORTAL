import { z } from 'zod'

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
})

/**
 * Public env. Next.js only inlines NEXT_PUBLIC_* when they are referenced as literal
 * `process.env.NAME`, so each one is read explicitly here.
 */
export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  })
}

/** Server-only secrets. Importing this from a client component is a bug. */
export function serverEnv() {
  return z.object({ SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) }).parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
}

/** False while .env.local still holds the placeholder values from .env.example. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return Boolean(url) && Boolean(key) && !url.includes('YOUR-PROJECT') && !key.includes('YOUR-ANON')
}
