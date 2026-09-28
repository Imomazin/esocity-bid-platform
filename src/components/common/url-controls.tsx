'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { NativeSelect } from '@/components/ui/input'

export function UrlSelect({
  param,
  value,
  options,
  label,
  className,
}: {
  param: string
  value: string
  options: { value: string; label: string }[]
  label: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return (
    <label className={className}>
      <span className="sr-only">{label}</span>
      <NativeSelect
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString())
          if (event.target.value) params.set(param, event.target.value)
          else params.delete(param)
          params.delete('page')
          router.push(`${pathname}?${params.toString()}`, { scroll: false })
        }}
        className="h-9 w-auto min-w-44 text-[13px]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  )
}
