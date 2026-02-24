import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserLock, User } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pencil, Trash2, Clock, Crown, UserPlus } from 'lucide-react'
import { EditPermissionsSheet } from './edit-permissions-sheet'
import { AddUserSheet } from './add-user-sheet'

interface LockUsersTabProps {
  lockId: string
  ownerId: string
}

type UserLockWithUser = UserLock & {
  users: Pick<User, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'avatar_url'>
}

const roleVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  owner: 'default',
  admin: 'default',
  family: 'secondary',
  scheduled: 'destructive',
  guest_otp: 'outline',
  guest_longterm: 'outline',
}

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  family: 'Family',
  scheduled: 'Scheduled',
  guest_otp: 'Guest (OTP)',
  guest_longterm: 'Guest (Long Term)',
}

export function LockUsersTab({ lockId, ownerId }: LockUsersTabProps) {
  const [userLocks, setUserLocks] = useState<UserLockWithUser[]>([])
  const [ownerInfo, setOwnerInfo] = useState<Pick<User, 'id' | 'first_name' | 'last_name' | 'email' | 'avatar_url'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingUserLock, setEditingUserLock] = useState<UserLockWithUser | null>(null)
  const [userToRemove, setUserToRemove] = useState<UserLockWithUser | null>(null)
  const [removing, setRemoving] = useState(false)
  const [addUserOpen, setAddUserOpen] = useState(false)

  async function fetchUsers() {
    try {
      const [userLocksResult, ownerResult] = await Promise.all([
        supabase
          .from('user_locks')
          .select('*, users(id, first_name, last_name, email, phone, avatar_url)')
          .eq('lock_id', lockId)
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, first_name, last_name, email, avatar_url')
          .eq('id', ownerId)
          .single(),
      ])

      if (userLocksResult.error) throw userLocksResult.error
      setUserLocks((userLocksResult.data as UserLockWithUser[]) || [])
      setOwnerInfo(ownerResult.data)
    } catch (error) {
      console.error('Error fetching lock users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [lockId])

  async function handleRemove() {
    if (!userToRemove) return
    setRemoving(true)
    try {
      const { error } = await supabase
        .from('user_locks')
        .delete()
        .eq('id', userToRemove.id)

      if (error) throw error
      setUserLocks(prev => prev.filter(ul => ul.id !== userToRemove.id))
      setUserToRemove(null)
    } catch (error) {
      console.error('Error removing user:', error)
    } finally {
      setRemoving(false)
    }
  }

  function handleEditSaved() {
    setEditingUserLock(null)
    fetchUsers()
  }

  // Check if owner is already in user_locks
  const ownerInUserLocks = userLocks.some(ul => ul.user_id === ownerId)

  const getPermissionSummary = (ul: UserLockWithUser) => {
    const perms: string[] = []
    if (ul.can_unlock) perms.push('Unlock')
    if (ul.can_lock) perms.push('Lock')
    if (ul.can_manage_users) perms.push('Manage Users')
    if (ul.can_modify_settings) perms.push('Settings')
    if (ul.can_view_logs) perms.push('Logs')
    if (ul.remote_unlock_enabled) perms.push('Remote')
    return perms
  }

  if (loading) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            User Management ({userLocks.length + (ownerInUserLocks ? 0 : 1)})
          </CardTitle>
          <Button size="sm" onClick={() => setAddUserOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add User
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Access Validity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Owner row (if not in user_locks) */}
              {!ownerInUserLocks && ownerInfo && (
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {ownerInfo.first_name?.[0]}{ownerInfo.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">
                          {ownerInfo.first_name} {ownerInfo.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{ownerInfo.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="gap-1">
                      <Crown className="h-3 w-3" />
                      Owner
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">All permissions</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">None</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">Permanent</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">Active</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-muted-foreground">—</span>
                  </TableCell>
                </TableRow>
              )}

              {/* User locks rows */}
              {userLocks.map((ul) => {
                const isOwner = ul.user_id === ownerId
                const perms = getPermissionSummary(ul)
                return (
                  <TableRow key={ul.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {ul.users?.first_name?.[0]}{ul.users?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {ul.users?.first_name} {ul.users?.last_name}
                            {isOwner && <Crown className="inline h-3 w-3 ml-1 text-yellow-500" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{ul.users?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleVariants[ul.role] || 'outline'}>
                        {roleLabels[ul.role] || ul.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {perms.slice(0, 3).map(p => (
                          <Badge key={p} variant="outline" className="text-xs">
                            {p}
                          </Badge>
                        ))}
                        {perms.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{perms.length - 3} more
                          </Badge>
                        )}
                        {perms.length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ul.time_restricted ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {ul.time_restriction_start} - {ul.time_restriction_end}
                          </div>
                          {ul.days_of_week && ul.days_of_week.length < 7 && (
                            <div className="flex gap-0.5">
                              {['S','M','T','W','T','F','S'].map((d, i) => (
                                <span
                                  key={i}
                                  className={`text-[10px] w-4 text-center rounded ${
                                    ul.days_of_week.includes(i)
                                      ? 'bg-primary text-primary-foreground'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ul.access_valid_from || ul.access_valid_until ? (
                        <div className="text-xs space-y-0.5">
                          {ul.access_valid_from && (
                            <div>From: {new Date(ul.access_valid_from).toLocaleDateString()}</div>
                          )}
                          {ul.access_valid_until && (
                            <div className={new Date(ul.access_valid_until) < new Date() ? 'text-destructive font-medium' : ''}>
                              Until: {new Date(ul.access_valid_until).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Permanent</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ul.is_active ? 'default' : 'secondary'}>
                        {ul.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isOwner ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingUserLock(ul)}
                            title="Edit permissions"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setUserToRemove(ul)}
                            title="Remove user"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}

              {userLocks.length === 0 && !ownerInfo && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users have access to this lock
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Permissions Sheet */}
      <EditPermissionsSheet
        open={!!editingUserLock}
        onOpenChange={(open) => !open && setEditingUserLock(null)}
        userLock={editingUserLock}
        onSave={handleEditSaved}
      />

      {/* Add User Sheet */}
      <AddUserSheet
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        lockId={lockId}
        existingUserIds={[ownerId, ...userLocks.map(ul => ul.user_id)]}
        onSave={() => { setAddUserOpen(false); fetchUsers() }}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!userToRemove} onOpenChange={(open) => !open && setUserToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{userToRemove?.users?.first_name} {userToRemove?.users?.last_name}</strong>'s
              access to this lock? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? 'Removing...' : 'Remove Access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
