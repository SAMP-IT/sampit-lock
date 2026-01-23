import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Lock } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Lock as LockIcon, Wifi, WifiOff, Battery, LayoutGrid, List } from 'lucide-react'

export function LocksPage() {
  const [locks, setLocks] = useState<Lock[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  useEffect(() => {
    async function fetchLocks() {
      try {
        const { data, error } = await supabase
          .from('locks')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setLocks(data || [])
      } catch (error) {
        console.error('Error fetching locks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLocks()
  }, [])

  const filteredLocks = locks.filter(lock => {
    const searchLower = searchQuery.toLowerCase()
    return (
      lock.name.toLowerCase().includes(searchLower) ||
      lock.location.toLowerCase().includes(searchLower)
    )
  })

  const getBatteryColor = (level: number) => {
    if (level > 50) return 'text-green-600'
    if (level > 20) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return <LocksSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Locks</h1>
          <p className="text-muted-foreground">Manage all smart locks in the system</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <LockIcon className="h-5 w-5" />
          <span>{locks.length} total locks</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Locks</CardTitle>
              <CardDescription>View and manage smart lock devices</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search locks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No locks found matching your search' : 'No locks found'}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredLocks.map((lock) => (
                <Card key={lock.id} className="overflow-hidden">
                  <div className={`h-2 ${lock.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{lock.name}</h3>
                        <p className="text-sm text-muted-foreground">{lock.location}</p>
                      </div>
                      {lock.is_online ? (
                        <Wifi className="h-5 w-5 text-green-600" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant={lock.is_locked ? 'default' : 'secondary'}>
                        {lock.is_locked ? 'Locked' : 'Unlocked'}
                      </Badge>
                      <div className={`flex items-center gap-1 text-sm ${getBatteryColor(lock.battery_level)}`}>
                        <Battery className="h-4 w-4" />
                        {lock.battery_level}%
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                      <p>Device ID: {lock.device_id}</p>
                      {lock.firmware_version && <p>Firmware: {lock.firmware_version}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead>Battery</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocks.map((lock) => (
                  <TableRow key={lock.id}>
                    <TableCell className="font-medium">{lock.name}</TableCell>
                    <TableCell>{lock.location}</TableCell>
                    <TableCell>
                      <Badge variant={lock.is_locked ? 'default' : 'secondary'}>
                        {lock.is_locked ? 'Locked' : 'Unlocked'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {lock.is_online ? (
                          <>
                            <Wifi className="h-4 w-4 text-green-600" />
                            <span className="text-green-600">Online</span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-400">Offline</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${getBatteryColor(lock.battery_level)}`}>
                        <Battery className="h-4 w-4" />
                        {lock.battery_level}%
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{lock.device_id}</TableCell>
                    <TableCell>
                      {lock.last_activity_at
                        ? new Date(lock.last_activity_at).toLocaleString()
                        : 'N/A'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LocksSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-5 w-56 mt-2" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
