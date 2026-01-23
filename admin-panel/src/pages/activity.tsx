import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/lib/supabase'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Activity, RefreshCw, Download } from 'lucide-react'

interface ActivityWithJoins extends ActivityLog {
  users?: { first_name: string; last_name: string }
  locks?: { name: string }
}

export function ActivityPage() {
  const [activities, setActivities] = useState<ActivityWithJoins[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  async function fetchActivity() {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, users(first_name, last_name), locks(name)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setActivities(data || [])
    } catch (error) {
      console.error('Error fetching activity:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchActivity()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchActivity()
  }

  const handleExport = () => {
    const headers = ['Time', 'Lock', 'User', 'Action', 'Method', 'Status']
    const rows = filteredActivities.map(a => [
      new Date(a.created_at).toLocaleString(),
      a.locks?.name || 'Unknown',
      a.users ? `${a.users.first_name} ${a.users.last_name}` : 'System',
      a.action,
      a.access_method || 'N/A',
      a.success ? 'Success' : 'Failed'
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const filteredActivities = activities.filter(activity => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      (activity.locks?.name?.toLowerCase().includes(searchLower) || false) ||
      (activity.users?.first_name?.toLowerCase().includes(searchLower) || false) ||
      (activity.users?.last_name?.toLowerCase().includes(searchLower) || false) ||
      activity.action.toLowerCase().includes(searchLower)

    const matchesAction = actionFilter === 'all' || activity.action === actionFilter

    return matchesSearch && matchesAction
  })

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'unlocked':
        return 'default'
      case 'locked':
        return 'secondary'
      case 'failed_attempt':
        return 'destructive'
      case 'tamper_detected':
        return 'destructive'
      case 'battery_warning':
        return 'outline'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return <ActivitySkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground">View all lock activity and events</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-5 w-5" />
          <span>{activities.length} events (last 100)</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Complete audit trail of lock events</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="unlocked">Unlocked</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                  <SelectItem value="failed_attempt">Failed Attempt</SelectItem>
                  <SelectItem value="auto_lock">Auto Lock</SelectItem>
                  <SelectItem value="tamper_detected">Tamper Detected</SelectItem>
                  <SelectItem value="battery_warning">Battery Warning</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || actionFilter !== 'all'
                ? 'No activity found matching your filters'
                : 'No activity recorded yet'
              }
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Lock</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(activity.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {activity.locks?.name || 'Unknown Lock'}
                    </TableCell>
                    <TableCell>
                      {activity.users
                        ? `${activity.users.first_name} ${activity.users.last_name}`
                        : 'System'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(activity.action)} className="capitalize">
                        {activity.action.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {activity.access_method || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={activity.success ? 'default' : 'destructive'}>
                        {activity.success ? 'Success' : 'Failed'}
                      </Badge>
                      {activity.failure_reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.failure_reason}
                        </p>
                      )}
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

function ActivitySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-5 w-56 mt-2" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
