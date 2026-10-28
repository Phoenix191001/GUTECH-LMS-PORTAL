'use client'

import { Select } from '@/components/ui/form'

/** A GET-form filter that submits as soon as the choice changes. Other params ride along as hidden inputs. */
export function FilterSelect({
  action,
  name,
  value,
  label,
  allLabel,
  options,
  carry,
  className,
}: {
  action: string
  name: string
  value?: string
  label: string
  allLabel: string
  options: [value: string, label: string][]
  carry: Record<string, string | undefined>
  className?: string
}) {
  return (
    <form method="get" action={action} className={className}>
      {Object.entries(carry)
        .filter(([k, v]) => k !== name && v)
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <label className="sr-only" htmlFor={`f-${name}`}>{label}</label>
      <Select id={`f-${name}`} name={name} defaultValue={value ?? ''} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="">{allLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </Select>
      <noscript>
        <button type="submit">Apply</button>
      </noscript>
    </form>
  )
}
