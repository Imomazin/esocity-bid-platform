'use client'

import { CheckIcon, Loader2Icon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { applyTheme, useTheme } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/client/api'
import { cn } from '@/lib/utils'

const THEMES = [
  { value: 'system', label: 'System', icon: MonitorIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
] as const

export function AppearanceForm() {
  const theme = useTheme()
  const choose = async (value: (typeof THEMES)[number]['value']) => {
    applyTheme(value)
    try {
      await api('/api/account/preferences', { method: 'PATCH', body: { theme: value } })
    } catch {
      // The theme is applied locally regardless; syncing it to the account is best-effort.
    }
  }
  return (
    <fieldset className="grid max-w-md grid-cols-3 gap-2">
      <legend className="sr-only">Theme</legend>
      {THEMES.map((item) => (
        <label
          key={item.value}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
            theme === item.value ? 'border-foreground bg-muted/60' : 'hover:border-foreground/30',
          )}
        >
          <input
            type="radio"
            name="theme"
            value={item.value}
            checked={theme === item.value}
            onChange={() => void choose(item.value)}
            className="sr-only"
          />
          <item.icon className="size-5" aria-hidden />
          {item.label}
        </label>
      ))}
    </fieldset>
  )
}

export function InterestsForm({
  categories,
  initial,
}: {
  categories: { slug: string; name: string }[]
  initial: string[]
}) {
  const [selected, setSelected] = useState<string[]>(initial)
  const [pending, setPending] = useState(false)
  const dirty =
    selected.length !== initial.length || selected.some((slug) => !initial.includes(slug))
  const toggle = (slug: string) =>
    setSelected((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    )
  const save = async () => {
    setPending(true)
    try {
      await api('/api/account/preferences', { method: 'PATCH', body: { interests: selected } })
      toast.success('Interests saved', {
        description: 'Recommendations will reflect your choices.',
      })
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save your interests.')
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Interests">
        {categories.map((category) => {
          const active = selected.includes(category.slug)
          return (
            <button
              key={category.slug}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(category.slug)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition',
                active
                  ? 'border-foreground bg-foreground text-background'
                  : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {active ? <CheckIcon className="size-3.5" aria-hidden /> : null}
              {category.name}
            </button>
          )
        })}
      </div>
      <Button onClick={save} disabled={pending || !dirty} size="sm">
        {pending ? <Loader2Icon className="animate-spin" /> : null} Save interests
      </Button>
    </div>
  )
}
