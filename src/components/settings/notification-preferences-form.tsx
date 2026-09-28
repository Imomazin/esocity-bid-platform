'use client'

import { Loader2Icon, LockIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  MANDATORY_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationPreferences,
  type NotificationType,
} from '@/domain/notifications'
import { api, ApiError } from '@/lib/client/api'

const CHANNELS: { id: NotificationChannel; label: string; description: string }[] = [
  { id: 'IN_APP', label: 'In-app', description: 'Always on — your notification inbox' },
  { id: 'EMAIL', label: 'Email', description: 'Sent to your account email' },
  { id: 'PUSH', label: 'Push', description: 'Browser or app push (when installed)' },
  { id: 'SMS', label: 'SMS', description: 'Text messages for time-critical alerts' },
]

export function NotificationPreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const [prefs, setPrefs] = useState(initial)
  const [pending, setPending] = useState(false)
  const setChannel = (channel: NotificationChannel, value: boolean) =>
    setPrefs((current) => ({ ...current, channels: { ...current.channels, [channel]: value } }))
  const setType = (type: NotificationType, value: boolean) =>
    setPrefs((current) => ({ ...current, types: { ...current.types, [type]: value } }))
  const save = async () => {
    setPending(true)
    try {
      const saved = await api<NotificationPreferences>('/api/account/notifications', {
        method: 'PUT',
        body: prefs,
      })
      setPrefs(saved)
      toast.success('Notification preferences saved')
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save your preferences.')
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium">Channels</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((channel) => (
            <div
              key={channel.id}
              className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
            >
              <span id={`channel-${channel.id}`}>
                {channel.label}
                <span className="block text-xs text-muted-foreground">{channel.description}</span>
              </span>
              <Switch
                checked={channel.id === 'IN_APP' ? true : prefs.channels[channel.id]}
                disabled={channel.id === 'IN_APP'}
                onCheckedChange={(checked) => setChannel(channel.id, checked)}
                aria-labelledby={`channel-${channel.id}`}
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">What we notify you about</p>
        <ul className="divide-y rounded-xl border">
          {NOTIFICATION_TYPES.map((type) => {
            const mandatory = MANDATORY_NOTIFICATION_TYPES.has(type)
            return (
              <li key={type} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span id={`type-${type}`} className="flex items-center gap-2">
                  {NOTIFICATION_TYPE_LABELS[type]}
                  {mandatory ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <LockIcon className="size-3" aria-hidden /> Always on
                    </span>
                  ) : null}
                </span>
                <Switch
                  checked={mandatory ? true : prefs.types[type]}
                  disabled={mandatory}
                  onCheckedChange={(checked) => setType(type, checked)}
                  aria-labelledby={`type-${type}`}
                />
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Responsible-use alerts, wins and account messages can’t be switched off because they
          protect you or relate to a transaction.
        </p>
      </div>
      <Button onClick={save} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null} Save preferences
      </Button>
    </div>
  )
}
