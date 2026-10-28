import { redirect } from 'next/navigation'

// The proxy already routes "/" (signed in -> /dashboard, signed out -> /login); this is the fallback.
export default function Home() {
  redirect('/dashboard')
}
