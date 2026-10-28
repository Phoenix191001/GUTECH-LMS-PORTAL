// Creates the first admin (spec Section 3: "created manually, then marked admin").
// Usage: fill ADMIN_* in .env, then `npm run bootstrap-admin`.
import { ensureUser } from './_client.mjs'

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const fullName = process.env.ADMIN_NAME || 'System Administrator'

if (!email || !password || password.length < 10) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 10 characters) in Backend/.env.')
  process.exit(1)
}

const id = await ensureUser({ email, password, fullName, role: 'admin', mustChangePassword: false })
console.log(`Admin ready: ${email} (${id}). Sign in at /login, then change the password from /profile.`)
