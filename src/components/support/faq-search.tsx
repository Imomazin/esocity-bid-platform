'use client'

import { ChevronDownIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface FaqItem {
  id: string
  category: string
  question: string
  answer: string
}

const CATEGORY_LABELS: Record<string, string> = {
  bidding: 'Bidding',
  wallet: 'Bid Wallet',
  orders: 'Orders & delivery',
  account: 'Account',
  drops: 'Flash Drops',
  rewards: 'Rewards',
}

export function FaqSearch({ faqs }: { faqs: FaqItem[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const categories = useMemo(() => [...new Set(faqs.map((faq) => faq.category))], [faqs])
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const visible = faqs.filter(
    (faq) =>
      (!category || faq.category === category) &&
      terms.every(
        (term) =>
          faq.question.toLowerCase().includes(term) || faq.answer.toLowerCase().includes(term),
      ),
  )
  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help articles — e.g. “refund”, “timer”, “recovery”"
          className="h-11 pl-9"
          aria-label="Search help articles"
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Help topics">
        {[null, ...categories].map((item) => (
          <button
            key={item ?? 'all'}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
            className={cn(
              'inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium transition',
              category === item
                ? 'border-foreground bg-foreground text-background'
                : 'bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {item ? (CATEGORY_LABELS[item] ?? item) : 'All topics'}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'article' : 'articles'}
      </p>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No articles match. Try different words, or contact us below.
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-card">
          {visible.map((faq) => (
            <li key={faq.id}>
              <details className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                  {faq.question}
                  <ChevronDownIcon
                    className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
