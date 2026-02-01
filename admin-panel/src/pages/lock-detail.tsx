import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Lock, LockSettings } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  Battery,
  Info,
  Activity,
  KeyRound,
  Fingerprint,
  CreditCard,
  Users,
} from 'lucide-react'
import { LockInfoTab } from '@/components/locks/lock-info-tab'
import { LockActivityTab } from '@/components/locks/lock-activity-tab'
import { LockPasscodesTab } from '@/components/locks/lock-passcodes-tab'
import { LockFingerprintsTab } from '@/components/locks/lock-fingerprints-tab'
import { LockICCardsTab } from '@/components/locks/lock-ic-cards-tab'
import { LockUsersTab } from '@/components/locks/lock-users-tab'

export function LockDetailPage() {
  const { lockId } = useParams<{ lockId: string }>()
  const [lock, setLock] = useState<Lock | null>(null)
  const [settings, setSettings] = useState<LockSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLock() {
      if (!lockId) return
      try {
        const [lockResult, settingsResult] = await Promise.all([
          supabase.from('locks').select('*').eq('id', lockId).single(),
          supabase.from('lock_settings').select('*').eq('lock_id', lockId).single(),
        ])

        if (lockResult.error) throw lockResult.error
        setLock(lockResult.data)
        setSettings(settingsResult.data)
      } catch (error) {
        console.error('Error fetching lock:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLock()
  }, [lockId])

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-green-600'
    if (level > 20) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return <LockDetailSkeleton />
  }

  if (!lock) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link to="/locks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Locks
          </Link>
        </Button>
        <div className="text-center py-16 text-muted-foreground">
          Lock not found
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/locks">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Locks
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{lock.lock_alias || lock.name}</h1>
          <p className="text-muted-foreground">{lock.location}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {lock.is_online ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-gray-400" />
            )}
            <Badge variant={lock.is_online ? 'default' : 'secondary'}>
              {lock.is_online ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <Badge variant={lock.is_locked ? 'default' : 'outline'}>
            {lock.is_locked ? 'Locked' : 'Unlocked'}
          </Badge>
          <div className={`flex items-center gap-1 text-sm font-medium ${getBatteryColor(lock.battery_level)}`}>
            <Battery className="h-4 w-4" />
            {lock.battery_level}%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">
            <Info className="h-4 w-4 mr-1.5" />
            Info
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-1.5" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="passcodes">
            <KeyRound className="h-4 w-4 mr-1.5" />
            Passcodes
          </TabsTrigger>
          <TabsTrigger value="fingerprints">
            <Fingerprint className="h-4 w-4 mr-1.5" />
            Fingerprints
          </TabsTrigger>
          <TabsTrigger value="ic-cards">
            <CreditCard className="h-4 w-4 mr-1.5" />
            IC Cards
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1.5" />
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <LockInfoTab lock={lock} settings={settings} />
        </TabsContent>
        <TabsContent value="activity">
          <LockActivityTab lockId={lock.id} />
        </TabsContent>
        <TabsContent value="passcodes">
          <LockPasscodesTab lockId={lock.id} />
        </TabsContent>
        <TabsContent value="fingerprints">
          <LockFingerprintsTab lockId={lock.id} />
        </TabsContent>
        <TabsContent value="ic-cards">
          <LockICCardsTab lockId={lock.id} />
        </TabsContent>
        <TabsContent value="users">
          <LockUsersTab lockId={lock.id} ownerId={lock.owner_id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LockDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-32 mt-2" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  )
}
