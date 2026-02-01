import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Search, RefreshCw } from 'lucide-react'

interface ActivityWithJoins extends ActivityLog {
  users?: { first_name: string; last_name: string }
}

interface LockActivityTabProps {
  lockId: string
}

export function LockActivityTab({ lockId }: LockActivityTabProps) {
  const [activities, setActivities] = useState<ActivityWithJoins[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  async function fetchActivity() {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, users:user_id(first_name, last_name)')
        .eq('lock_id', lockId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setActivities(data || [])
    } catch (error) {
      console.error('Error fetching lock activity:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchActivity()
  }, [lockId])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchActivity()
  }

  const filteredActivities = activities.filter(activity => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      (activity.users?.first_name?.toLowerCase().includes(searchLower) || false) ||
      (activity.users?.last_name?.toLowerCase().includes(searchLower) || false) ||
      activity.action.toLowerCase().includes(searchLower)

    const matchesAction = actionFilter === 'all' || activity.action === actionFilter

    return matchesSearch && matchesAction
  })

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'unlocked': return 'default'
      case 'locked': return 'secondary'
      case 'failed_attempt': return 'destructive'
      case 'tamper_detected': return 'destructive'
      case 'battery_warning': return 'outline'
      default: return 'outline'
    }
  }

  if (loading) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-lg">Activity Logs</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-56">
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
                <SelectValue placeholder="Filter action" />
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery || actionFilter !== 'all'
              ? 'No activity found matching your filters'
              : 'No activity recorded for this lock'
            }
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
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
  )
}
