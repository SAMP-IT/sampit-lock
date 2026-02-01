import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Users as UsersIcon } from 'lucide-react'

interface UserLockInfo {
  lock_id: string
  lock_name: string
  lock_location: string
  role: string
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userLocksMap, setUserLocksMap] = useState<Map<string, UserLockInfo[]>>(new Map())

  useEffect(() => {
    async function fetchData() {
      try {
        const [usersResult, userLocksResult, locksResult] = await Promise.all([
          supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('user_locks')
            .select('user_id, lock_id, role, is_active, locks(id, name, location)')
            .eq('is_active', true),
          supabase
            .from('locks')
            .select('id, name, location, owner_id'),
        ])

        if (usersResult.error) throw usersResult.error
        setUsers(usersResult.data || [])

        // Build user → locks map
        const map = new Map<string, UserLockInfo[]>()

        // Add user_locks entries
        if (userLocksResult.data) {
          for (const ul of userLocksResult.data) {
            const lockData = ul.locks as unknown as { id: string; name: string; location: string } | null
            if (!lockData) continue
            if (!map.has(ul.user_id)) map.set(ul.user_id, [])
            map.get(ul.user_id)!.push({
              lock_id: ul.lock_id,
              lock_name: lockData.name,
              lock_location: lockData.location,
              role: ul.role,
            })
          }
        }

        // Add owner entries (owners may not have user_locks rows)
        if (locksResult.data) {
          for (const lock of locksResult.data) {
            if (!lock.owner_id) continue
            if (!map.has(lock.owner_id)) map.set(lock.owner_id, [])
            const existing = map.get(lock.owner_id)!
            if (!existing.some(e => e.lock_id === lock.id)) {
              existing.push({
                lock_id: lock.id,
                lock_name: lock.name,
                lock_location: lock.location,
                role: 'owner',
              })
            }
          }
        }

        setUserLocksMap(map)
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase()
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.first_name.toLowerCase().includes(searchLower) ||
      user.last_name.toLowerCase().includes(searchLower)
    )
  })

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default'
      case 'enterprise':
        return 'default'
      case 'family':
        return 'secondary'
      case 'guest':
        return 'outline'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return <UsersSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage all users in the system</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <UsersIcon className="h-5 w-5" />
          <span>{users.length} total users</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>View and manage user accounts</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No users found matching your search' : 'No users found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Paired Locks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const pairedLocks = userLocksMap.get(user.id) || []
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {user.first_name[0]}{user.last_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.first_name} {user.last_name}</p>
                            {user.phone && (
                              <p className="text-sm text-muted-foreground">{user.phone}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {pairedLocks.map((ul) => (
                            <Link key={ul.lock_id} to={`/locks/${ul.lock_id}`}>
                              <Badge
                                variant="outline"
                                className="text-xs cursor-pointer hover:bg-accent transition-colors"
                              >
                                {ul.lock_name} ({ul.role})
                              </Badge>
                            </Link>
                          ))}
                          {pairedLocks.length === 0 && (
                            <span className="text-sm text-muted-foreground">No locks</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'destructive'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function UsersSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-5 w-48 mt-2" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
