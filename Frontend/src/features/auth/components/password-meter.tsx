'use client'

import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PASSWORD_RULES, passwordStrength } from '../schemas'

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const COLORS = ['bg-border', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success']

/** Strength meter + live rule checklist (spec Feature 10, req. 5). */
export function PasswordMeter({ password, email = '' }: { password: string; email?: string }) {
  const score = passwordStrength(password, email)
  return (
    <div className="space-y-3" aria-live="polite">
      <div>
        <div className="flex gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= score ? COLORS[score] : 'bg-muted')} />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Strength: <span className="font-medium text-foreground">{password ? LABELS[score] : '—'}</span>
        </p>
      </div>
      <ul className="grid gap-1.5 text-[0.8125rem] sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password, email)
          return (
            <li key={rule.id} className={cn('flex items-center gap-2', ok ? 'text-success' : 'text-muted-foreground')}>
              {ok ? <Check className="size-3.5" /> : <Circle className="size-3.5" />}
              <span>{rule.label}</span>
              <span className="sr-only">{ok ? '(met)' : '(not met)'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
