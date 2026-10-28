'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/form'

/** URL-driven search box (?q=). Debounced; resets pagination. */
export function SearchInput({
  placeholder = 'Search…',
  param = 'q',
  className,
}: {
  placeholder?: string
  param?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [value, setValue] = useState(sp.get(param) ?? '')
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const id = setTimeout(() => {
      const next = new URLSearchParams(sp.toString())
      if (value.trim()) next.set(param, value.trim())
      else next.delete(param)
      next.delete('page')
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className={`relative ${className ?? ''}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  )
}
