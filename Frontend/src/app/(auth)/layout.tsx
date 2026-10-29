import { BookOpenCheck, MessagesSquare, ShieldCheck, TimerReset } from 'lucide-react'
import { Logo } from '@/components/shared/logo'
import { BRAND } from '@/lib/brand'

const POINTS = [
  { icon: BookOpenCheck, text: 'Resources, assignments and quizzes in one calm workspace' },
  { icon: TimerReset, text: 'Deadlines and timers run on the server clock, so they are always fair' },
  { icon: MessagesSquare, text: 'A realtime chat room for every course' },
  { icon: ShieldCheck, text: 'Closed system: accounts are created by your administrator' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-[oklch(0.33_0.14_22)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(40rem 26rem at 100% 100%, oklch(0.65 0.2 25 / 0.4), transparent 65%), radial-gradient(34rem 24rem at 0% 100%, oklch(0.9 0.05 20 / 0.15), transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }}
        />
        <Logo tone="light" className="relative -ml-5 w-56" />
        <div className="relative max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">{BRAND.product}</p>
          <h2 className="mt-4 font-display text-5xl font-extrabold leading-[1.05] text-white text-balance">{BRAND.tagline}</h2>
          <ul className="mt-10 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3.5 text-[0.9375rem] text-sidebar-foreground/90">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/20 text-white">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-sidebar-muted">Need an account? Ask your administrator.</p>
      </aside>

      {/* Form column */}
      <main id="main" className="flex min-h-dvh flex-col px-5 py-8 sm:px-10">
        <Logo className="mx-auto w-44 lg:hidden" />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-xs text-muted-foreground lg:hidden">Need an account? Ask your administrator.</p>
      </main>
    </div>
  )
}
