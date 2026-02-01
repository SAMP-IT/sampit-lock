import type { Lock, LockSettings } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface LockInfoTabProps {
  lock: Lock
  settings: LockSettings | null
}

export function LockInfoTab({ lock, settings }: LockInfoTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 mt-4">
      {/* Lock Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lock Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Name" value={lock.name} />
          {lock.lock_alias && <InfoRow label="Alias" value={lock.lock_alias} />}
          <InfoRow label="Location" value={lock.location} />
          <InfoRow label="Lock Type" value={lock.lock_type} />
          <InfoRow label="Device ID" value={lock.device_id} mono />
          {lock.mac_address && <InfoRow label="MAC Address" value={lock.mac_address} mono />}
          {lock.firmware_version && <InfoRow label="Firmware" value={lock.firmware_version} />}
          {lock.ttlock_lock_id && <InfoRow label="TTLock ID" value={String(lock.ttlock_lock_id)} mono />}
          {lock.ttlock_mac && <InfoRow label="TTLock MAC" value={lock.ttlock_mac} mono />}
          <Separator />
          <InfoRow label="Paired At" value={new Date(lock.paired_at).toLocaleString()} />
          <InfoRow label="Created" value={new Date(lock.created_at).toLocaleString()} />
          {lock.last_sync_at && (
            <InfoRow label="Last Sync" value={new Date(lock.last_sync_at).toLocaleString()} />
          )}
          {lock.last_activity_at && (
            <InfoRow label="Last Activity" value={new Date(lock.last_activity_at).toLocaleString()} />
          )}
        </CardContent>
      </Card>

      {/* Status */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Lock State</span>
              <Badge variant={lock.is_locked ? 'default' : 'secondary'}>
                {lock.lock_state || (lock.is_locked ? 'Locked' : 'Unlocked')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Online</span>
              <Badge variant={lock.is_online ? 'default' : 'outline'}>
                {lock.is_online ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Connected</span>
              <Badge variant={lock.is_connected ? 'default' : 'outline'}>
                {lock.is_connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            {lock.is_bluetooth_paired !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bluetooth Paired</span>
                <Badge variant={lock.is_bluetooth_paired ? 'default' : 'outline'}>
                  {lock.is_bluetooth_paired ? 'Yes' : 'No'}
                </Badge>
              </div>
            )}
            {lock.has_gateway !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Has Gateway</span>
                <Badge variant={lock.has_gateway ? 'default' : 'outline'}>
                  {lock.has_gateway ? 'Yes' : 'No'}
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Battery</span>
              <span className={`text-sm font-medium ${getBatteryColor(lock.battery_level)}`}>
                {lock.battery_level}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Settings */}
        {settings && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SettingRow label="Auto Lock" enabled={settings.auto_lock_enabled} detail={`${settings.auto_lock_delay}s delay`} />
              <SettingRow label="Remote Unlock" enabled={settings.remote_unlock_enabled} />
              <SettingRow label="Passage Mode" enabled={settings.passage_mode_enabled} />
              <SettingRow label="Tamper Alert" enabled={settings.tamper_alert_enabled} />
              {settings.lock_sound_enabled !== undefined && (
                <SettingRow label="Lock Sound" enabled={settings.lock_sound_enabled} detail={settings.lock_sound_volume ? `Vol: ${settings.lock_sound_volume}` : undefined} />
              )}
              {settings.offline_alert_enabled !== undefined && (
                <SettingRow label="Offline Alert" enabled={settings.offline_alert_enabled} />
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Low Battery Threshold</span>
                <span className="text-sm">{settings.low_battery_threshold}%</span>
              </div>
              {settings.timezone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Timezone</span>
                  <span className="text-sm">{settings.timezone}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function SettingRow({ label, enabled, detail }: { label: string; enabled: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
        <Badge variant={enabled ? 'default' : 'outline'}>
          {enabled ? 'On' : 'Off'}
        </Badge>
      </div>
    </div>
  )
}

function getBatteryColor(level: number) {
  if (level > 50) return 'text-green-600'
  if (level > 20) return 'text-yellow-600'
  return 'text-red-600'
}
