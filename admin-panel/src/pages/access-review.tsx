import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AlertTriangle, Clock, ShieldAlert, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AccessRecord {
  id: string
  user_id: string
  lock_id: string
  role: string
  is_active: boolean
  access_valid_from?: string
  access_valid_until?: string
  credentials_cleanup_status?: string | null
  created_at: string
  users: { first_name: string; last_name: string; email: string } | null
  locks: { name: string; location: string } | null
}

interface SyncIssue {
  table: string
  id: string
  lock_id: string
  sync_status: string
  sync_error?: string
  name: string
  lock_name: string
}

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  family: 'Family',
  scheduled: 'Scheduled',
  guest_otp: 'Guest (OTP)',
  guest_longterm: 'Guest (Long Term)',
}

export function AccessReviewPage() {
  const [loading, setLoading] = useState(true)
  const [expiredAccess, setExpiredAccess] = useState<AccessRecord[]>([])
  const [expiringSoon, setExpiringSoon] = useState<AccessRecord[]>([])
  const [pendingCleanup, setPendingCleanup] = useState<AccessRecord[]>([])
  const [syncIssues, setSyncIssues] = useState<SyncIssue[]>([])

  async function fetchData() {
    setLoading(true)
    try {
      const now = new Date().toISOString()
      const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const [expiredResult, expiringResult, cleanupResult, fpSyncResult, pcSyncResult, icSyncResult] = await Promise.all([
        // Expired but still active
        supabase
          .from('user_locks')
          .select('id, user_id, lock_id, role, is_active, access_valid_until, credentials_cleanup_status, created_at, users(first_name, last_name, email), locks(name, location)')
          .eq('is_active', true)
          .lt('access_valid_until', now)
          .order('access_valid_until', { ascending: true })
          .limit(50),
        // Expiring within 7 days
        supabase
          .from('user_locks')
          .select('id, user_id, lock_id, role, is_active, access_valid_from, access_valid_until, created_at, users(first_name, last_name, email), locks(name, location)')
          .eq('is_active', true)
          .gt('access_valid_until', now)
          .lt('access_valid_until', sevenDaysOut)
          .order('access_valid_until', { ascending: true })
          .limit(50),
        // Pending credential cleanup
        supabase
          .from('user_locks')
          .select('id, user_id, lock_id, role, is_active, access_valid_until, credentials_cleanup_status, created_at, users(first_name, last_name, email), locks(name, location)')
          .in('credentials_cleanup_status', ['pending', 'failed'])
          .order('created_at', { ascending: false })
          .limit(50),
        // Fingerprint sync issues
        supabase
          .from('fingerprints')
          .select('id, lock_id, sync_status, sync_error, fingerprint_name, locks(name)')
          .neq('sync_status', 'synced')
          .not('sync_status', 'is', null)
          .limit(20),
        // Passcode sync issues
        supabase
          .from('passcodes')
          .select('id, lock_id, sync_status, sync_error, name, locks(name)')
          .neq('sync_status', 'synced')
          .not('sync_status', 'is', null)
          .limit(20),
        // IC Card sync issues
        supabase
          .from('ic_cards')
          .select('id, lock_id, sync_status, sync_error, card_name, locks(name)')
          .neq('sync_status', 'synced')
          .not('sync_status', 'is', null)
          .limit(20),
      ])

      setExpiredAccess((expiredResult.data as unknown as AccessRecord[]) || [])
      setExpiringSoon((expiringResult.data as unknown as AccessRecord[]) || [])
      setPendingCleanup((cleanupResult.data as unknown as AccessRecord[]) || [])

      // Combine sync issues from all credential tables
      const issues: SyncIssue[] = []
      for (const fp of (fpSyncResult.data || [])) {
        const lockData = fp.locks as unknown as { name: string } | null
        issues.push({
          table: 'Fingerprint',
          id: fp.id,
          lock_id: fp.lock_id,
          sync_status: fp.sync_status || 'unknown',
          sync_error: fp.sync_error || undefined,
          name: fp.fingerprint_name || 'Unnamed',
          lock_name: lockData?.name || 'Unknown Lock',
        })
      }
      for (const pc of (pcSyncResult.data || [])) {
        const lockData = pc.locks as unknown as { name: string } | null
        issues.push({
          table: 'Passcode',
          id: pc.id,
          lock_id: pc.lock_id,
          sync_status: pc.sync_status || 'unknown',
          sync_error: pc.sync_error || undefined,
          name: pc.name || 'Unnamed',
          lock_name: lockData?.name || 'Unknown Lock',
        })
      }
      for (const ic of (icSyncResult.data || [])) {
        const lockData = ic.locks as unknown as { name: string } | null
        issues.push({
          table: 'IC Card',
          id: ic.id,
          lock_id: ic.lock_id,
          sync_status: ic.sync_status || 'unknown',
          sync_error: ic.sync_error || undefined,
          name: ic.card_name || 'Unnamed',
          lock_name: lockData?.name || 'Unknown Lock',
        })
      }
      setSyncIssues(issues)
    } catch (error) {
      console.error('Error fetching access review data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-80 mt-2" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Access Review</h1>
          <p className="text-muted-foreground">Monitor access health, expiry, and credential sync status</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expired (Still Active)</CardDescription>
            <CardTitle className="text-2xl">{expiredAccess.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Users past their access_valid_until but still active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expiring in 7 Days</CardDescription>
            <CardTitle className="text-2xl">{expiringSoon.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Active access that will expire within a week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Cleanup</CardDescription>
            <CardTitle className="text-2xl">{pendingCleanup.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Credentials awaiting removal from lock hardware</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sync Issues</CardDescription>
            <CardTitle className="text-2xl">{syncIssues.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Credentials not synced with physical lock</p>
          </CardContent>
        </Card>
      </div>

      {/* Expired Access Table */}
      {expiredAccess.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg">Expired Access — Still Active</CardTitle>
            </div>
            <CardDescription>
              These users have passed their expiry date but their access hasn't been deactivated yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Lock</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expired</TableHead>
                  <TableHead>Cleanup</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiredAccess.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {record.users?.first_name?.[0]}{record.users?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{record.users?.first_name} {record.users?.last_name}</p>
                          <p className="text-xs text-muted-foreground">{record.users?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link to={`/locks/${record.lock_id}`} className="text-sm hover:underline">
                        {record.locks?.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabels[record.role] || record.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-destructive">
                        {record.access_valid_until ? new Date(record.access_valid_until).toLocaleDateString() : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        record.credentials_cleanup_status === 'completed' ? 'default' :
                        record.credentials_cleanup_status === 'failed' ? 'destructive' :
                        record.credentials_cleanup_status === 'pending' ? 'outline' : 'secondary'
                      }>
                        {record.credentials_cleanup_status || 'N/A'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Expiring Soon Table */}
      {expiringSoon.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">Expiring Soon</CardTitle>
            </div>
            <CardDescription>Access that will expire within the next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Lock</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringSoon.map(record => {
                  const daysLeft = record.access_valid_until
                    ? Math.ceil((new Date(record.access_valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : 0
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {record.users?.first_name?.[0]}{record.users?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{record.users?.first_name} {record.users?.last_name}</p>
                            <p className="text-xs text-muted-foreground">{record.users?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link to={`/locks/${record.lock_id}`} className="text-sm hover:underline">
                          {record.locks?.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{roleLabels[record.role] || record.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {record.access_valid_until ? new Date(record.access_valid_until).toLocaleDateString() : '—'}
                          <span className={`ml-2 text-xs ${daysLeft <= 1 ? 'text-destructive' : 'text-yellow-600'}`}>
                            ({daysLeft}d left)
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pending Credential Cleanup */}
      {pendingCleanup.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-lg">Pending Credential Cleanup</CardTitle>
            </div>
            <CardDescription>
              Credentials on lock hardware that need to be removed (handled by the cleanup Edge Function)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Lock</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCleanup.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {record.users?.first_name?.[0]}{record.users?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-sm">{record.users?.first_name} {record.users?.last_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link to={`/locks/${record.lock_id}`} className="text-sm hover:underline">
                        {record.locks?.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabels[record.role] || record.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.credentials_cleanup_status === 'failed' ? 'destructive' : 'outline'}>
                        {record.credentials_cleanup_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Sync Issues */}
      {syncIssues.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Credential Sync Issues</CardTitle>
            </div>
            <CardDescription>Credentials that are out of sync with the physical lock hardware</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Lock</TableHead>
                  <TableHead>Sync Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncIssues.map(issue => (
                  <TableRow key={`${issue.table}-${issue.id}`}>
                    <TableCell>
                      <Badge variant="secondary">{issue.table}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{issue.name}</TableCell>
                    <TableCell>
                      <Link to={`/locks/${issue.lock_id}`} className="text-sm hover:underline">
                        {issue.lock_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={issue.sync_status === 'failed' ? 'destructive' : 'outline'}>
                        {issue.sync_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{issue.sync_error || '—'}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All clear message */}
      {expiredAccess.length === 0 && expiringSoon.length === 0 && pendingCleanup.length === 0 && syncIssues.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">All clear — no access issues found</p>
            <p className="text-sm text-muted-foreground mt-1">All user access is within valid dates and credentials are synced.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
