import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Lock, ActivityLog } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Lock as LockIcon, Activity, Battery, Wifi, WifiOff } from 'lucide-react'

interface Stats {
  totalUsers: number
  totalLocks: number
  onlineLocks: number
  recentActivity: number
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [locks, setLocks] = useState<Lock[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch counts
        const [usersResult, locksResult, activityResult] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }),
          supabase.from('locks').select('*'),
          supabase.from('activity_logs').select('*, users(first_name, last_name), locks(name)').order('created_at', { ascending: false }).limit(10),
        ])

        const locksData = locksResult.data || []
        const onlineLocks = locksData.filter(l => l.is_online).length

        setStats({
          totalUsers: usersResult.count || 0,
          totalLocks: locksData.length,
          onlineLocks,
          recentActivity: activityResult.data?.length || 0,
        })
        setLocks(locksData)
        setRecentActivity(activityResult.data || [])
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Awakey Admin Panel</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Locks</CardTitle>
            <LockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLocks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Online Locks</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.onlineLocks}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalLocks ? Math.round((stats.onlineLocks / stats.totalLocks) * 100) : 0}% online
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recentActivity}</div>
            <p className="text-xs text-muted-foreground">Last 10 events</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lock Status */}
        <Card>
          <CardHeader>
            <CardTitle>Lock Status</CardTitle>
            <CardDescription>Overview of all locks in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {locks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No locks found</p>
            ) : (
              <div className="space-y-3">
                {locks.map((lock) => (
                  <div key={lock.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${lock.is_online ? 'bg-green-100 dark:bg-green-950' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        {lock.is_online ? (
                          <Wifi className="h-4 w-4 text-green-600" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{lock.name}</p>
                        <p className="text-sm text-muted-foreground">{lock.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={lock.is_locked ? 'default' : 'secondary'}>
                        {lock.is_locked ? 'Locked' : 'Unlocked'}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Battery className="h-4 w-4" />
                        {lock.battery_level}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest lock events</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium capitalize">{activity.action.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">
                        {(activity as any).locks?.name || 'Unknown Lock'} - {(activity as any).users?.first_name || 'System'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={activity.success ? 'default' : 'destructive'}>
                        {activity.success ? 'Success' : 'Failed'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
