'use client'

import { GavelIcon, LayersIcon, SearchIcon, TagIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { api } from '@/lib/client/api'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'

interface Suggestions {
  products: { slug: string; name: string; brandName: string; priceMinor: number }[]
  brands: { slug: string; name: string }[]
  categories: { slug: string; name: string }[]
  auctions: { id: string; title: string; status: string; priceMinor: number }[]
}

interface Option {
  key: string
  href: string
  label: string
  meta: string
  kind: 'product' | 'auction' | 'category' | 'brand'
}

function toOptions(data: Suggestions): Option[] {
  return [
    ...data.auctions.map((item) => ({
      key: `a-${item.id}`,
      href: `/auction/${item.id}`,
      label: item.title,
      meta: `${item.status === 'LIVE' ? 'Live auction' : 'Upcoming auction'} · ${formatMinor(item.priceMinor)}`,
      kind: 'auction' as const,
    })),
    ...data.products.map((item) => ({
      key: `p-${item.slug}`,
      href: `/product/${item.slug}`,
      label: item.name,
      meta: `${item.brandName} · ${formatMinor(item.priceMinor)}`,
      kind: 'product' as const,
    })),
    ...data.categories.map((item) => ({
      key: `c-${item.slug}`,
      href: `/category/${item.slug}`,
      label: item.name,
      meta: 'Category',
      kind: 'category' as const,
    })),
    ...data.brands.map((item) => ({
      key: `b-${item.slug}`,
      href: `/marketplace?brand=${item.slug}`,
      label: item.name,
      meta: 'Brand',
      kind: 'brand' as const,
    })),
  ]
}

const ICONS = { product: TagIcon, auction: GavelIcon, category: LayersIcon, brand: TagIcon }

export function HeaderSearch({
  className,
  autoFocus = false,
  onNavigate,
}: {
  className?: string
  autoFocus?: boolean
  onNavigate?: () => void
}) {
  const router = useRouter()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const data = await api<Suggestions>(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        setOptions(toOptions(data))
        setActive(-1)
        setOpen(true)
      } catch {
        // Suggestions are best-effort.
      }
    }, 160)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    onNavigate?.()
    router.push(href)
  }

  const visible = open && query.trim().length >= 2
  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          const option = options[active]
          if (visible && option) go(option.href)
          else if (query.trim()) go(`/search?q=${encodeURIComponent(query.trim())}`)
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search products, brands and auctions
        </label>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground"
          aria-hidden
        />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={visible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            if (event.target.value.trim().length < 2) setOpen(false)
          }}
          onFocus={() => options.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (!visible) return
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((value) => Math.min(options.length - 1, value + 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((value) => Math.max(-1, value - 1))
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Search products, brands, auctions…"
          className="h-10 w-full rounded-xl border border-transparent bg-muted pr-3 pl-9 text-sm transition outline-none placeholder:text-subtle-foreground focus:border-input focus:bg-card focus:ring-3 focus:ring-ring/15"
        />
      </form>
      {visible ? (
        <div className="absolute inset-x-0 top-12 z-50 overflow-hidden rounded-xl border bg-popover shadow-raised">
          {options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No quick matches. Press Enter to search everything.
            </p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Search suggestions"
              className="max-h-96 overflow-y-auto p-1.5"
            >
              {options.map((option, index) => {
                const Icon = ICONS[option.kind]
                return (
                  <li
                    key={option.key}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      go(option.href)
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2',
                      index === active && 'bg-muted',
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{option.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.meta}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
