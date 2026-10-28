import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key || url.includes('YOUR-PROJECT') || key.includes('YOUR-SERVICE')) {
  console.error('Fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Backend/.env first.')
  process.exit(1)
}

/** Service-role client. Server-side scripts only: never ship this key to a browser. */
export const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Creates the auth user (or finds the existing one) and upserts the matching profile. */
export async function ensureUser({ email, password, fullName, role, rollNo = null, mustChangePassword = false }) {
  const normalized = email.toLowerCase()
  let userId

  const created = await admin.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
  })
  if (created.error) {
    if (!/already|registered|exists/i.test(created.error.message)) throw created.error
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw error
    userId = data.users.find((u) => u.email?.toLowerCase() === normalized)?.id
    if (!userId) throw new Error(`User ${normalized} exists but could not be found.`)
  } else {
    userId = created.data.user.id
  }

  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      email: normalized,
      full_name: fullName,
      role,
      roll_no: rollNo,
      is_active: true,
      must_change_password: mustChangePassword,
    },
    { onConflict: 'id' },
  )
  if (error) {
    // never leave an auth user without a profile
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    throw error
  }
  return userId
}
