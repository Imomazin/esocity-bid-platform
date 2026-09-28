'use client'

import { Loader2Icon, UserCogIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { NativeSelect } from '@/components/ui/input'
import { api, ApiError } from '@/lib/client/api'

/** Demo only: switch the simulated operator role to see how permissions change the console. */
export function RoleSwitcher({
  role,
  roles,
}: {
  role: string
  roles: { value: string; label: string }[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : (
        <UserCogIcon className="size-4" aria-hidden />
      )}
      <span className="hidden sm:inline">Demo role</span>
      <NativeSelect
        aria-label="Demo operator role"
        className="h-8 w-44 text-xs"
        value={role}
        disabled={pending}
        onChange={async (event) => {
          setPending(true)
          try {
            await api('/api/admin/role', { body: { role: event.target.value } })
            toast.success('Role switched', {
              description: 'Navigation and actions now reflect this role’s permissions.',
            })
            router.refresh()
          } catch (caught) {
            toast.error(caught instanceof ApiError ? caught.message : 'Could not switch role.')
          } finally {
            setPending(false)
          }
        }}
      >
        {roles.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  )
}
