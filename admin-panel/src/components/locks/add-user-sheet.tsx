import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserLockRole, User } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search } from 'lucide-react'

interface AddUserSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lockId: string
  existingUserIds: string[]
  onSave: () => void
}

type PickedUser = Pick<User, 'id' | 'first_name' | 'last_name' | 'email' | 'avatar_url'>

const ROLE_DEFAULTS: Record<Exclude<UserLockRole, 'owner'>, {
  can_unlock: boolean; can_lock: boolean; remote_unlock_enabled: boolean
  can_view_logs: boolean; can_view_all_logs: boolean
  can_manage_users: boolean; can_modify_settings: boolean
  time_restricted: boolean; days_of_week: number[]
}> = {
  admin: {
    can_unlock: true, can_lock: true, remote_unlock_enabled: true,
    can_view_logs: true, can_view_all_logs: true, can_manage_users: true,
    can_modify_settings: true, time_restricted: false, days_of_week: [0,1,2,3,4,5,6],
  },
  family: {
    can_unlock: true, can_lock: true, remote_unlock_enabled: true,
    can_view_logs: true, can_view_all_logs: false, can_manage_users: false,
    can_modify_settings: false, time_restricted: false, days_of_week: [0,1,2,3,4,5,6],
  },
  scheduled: {
    can_unlock: true, can_lock: true, remote_unlock_enabled: false,
    can_view_logs: false, can_view_all_logs: false, can_manage_users: false,
    can_modify_settings: false, time_restricted: true, days_of_week: [1,2,3,4,5],
  },
  guest_otp: {
    can_unlock: true, can_lock: false, remote_unlock_enabled: false,
    can_view_logs: false, can_view_all_logs: false, can_manage_users: false,
    can_modify_settings: false, time_restricted: false, days_of_week: [0,1,2,3,4,5,6],
  },
  guest_longterm: {
    can_unlock: true, can_lock: true, remote_unlock_enabled: false,
    can_view_logs: false, can_view_all_logs: false, can_manage_users: false,
    can_modify_settings: false, time_restricted: false, days_of_week: [0,1,2,3,4,5,6],
  },
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full access, can manage users and settings',
  family: 'Unlock/lock anytime, view own activity',
  scheduled: 'Access restricted to specific days and time windows',
  guest_otp: 'One-time access via OTP code',
  guest_longterm: 'Temporary access with expiry date',
}

export function AddUserSheet({ open, onOpenChange, lockId, existingUserIds, onSave }: AddUserSheetProps) {
  const [step, setStep] = useState<'select-user' | 'configure'>('select-user')
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<PickedUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<PickedUser | null>(null)
  const [role, setRole] = useState<Exclude<UserLockRole, 'owner'>>('family')
  const [accessValidFrom, setAccessValidFrom] = useState('')
  const [accessValidUntil, setAccessValidUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (open) {
      setStep('select-user')
      setSearchQuery('')
      setUsers([])
      setSelectedUser(null)
      setRole('family')
      setAccessValidFrom('')
      setAccessValidUntil('')
      setError(null)
    }
  }, [open])

  async function searchUsers(query: string) {
    setSearchQuery(query)
    if (query.length < 2) {
      setUsers([])
      return
    }
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, avatar_url')
        .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(10)

      if (error) throw error
      // Filter out users who already have access
      setUsers((data || []).filter(u => !existingUserIds.includes(u.id)))
    } catch (err) {
      console.error('Error searching users:', err)
    } finally {
      setSearching(false)
    }
  }

  function selectUser(user: PickedUser) {
    setSelectedUser(user)
    setStep('configure')
  }

  async function handleSave() {
    if (!selectedUser) return
    setSaving(true)
    setError(null)

    const defaults = ROLE_DEFAULTS[role]

    try {
      const { error: insertError } = await supabase
        .from('user_locks')
        .insert({
          user_id: selectedUser.id,
          lock_id: lockId,
          role,
          ...defaults,
          access_valid_from: accessValidFrom || null,
          access_valid_until: accessValidUntil || null,
          is_active: true,
          vacation_disabled: false,
        })

      if (insertError) throw insertError
      onSave()
    } catch (err) {
      console.error('Error adding user:', err)
      setError(err instanceof Error ? err.message : 'Failed to add user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add User to Lock</SheetTitle>
          <SheetDescription>
            {step === 'select-user'
              ? 'Search for an existing user to grant access'
              : `Configure access for ${selectedUser?.first_name} ${selectedUser?.last_name}`
            }
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {step === 'select-user' && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => searchUsers(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              {searching && (
                <p className="text-sm text-muted-foreground text-center py-4">Searching...</p>
              )}

              {!searching && users.length === 0 && searchQuery.length >= 2 && (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              )}

              {!searching && searchQuery.length > 0 && searchQuery.length < 2 && (
                <p className="text-sm text-muted-foreground text-center py-4">Type at least 2 characters</p>
              )}

              <div className="space-y-1">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => selectUser(user)}
                    className="flex items-center gap-3 w-full p-3 rounded-md hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'configure' && selectedUser && (
            <>
              {/* Selected user info */}
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{selectedUser.first_name} {selectedUser.last_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  onClick={() => { setStep('select-user'); setSelectedUser(null) }}
                >
                  Change
                </Button>
              </div>

              <Separator />

              {/* Role selection */}
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Role</h3>
                <Select value={role} onValueChange={(v) => setRole(v as Exclude<UserLockRole, 'owner'>)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="family">Family / Resident</SelectItem>
                    <SelectItem value="scheduled">Scheduled / Restricted</SelectItem>
                    <SelectItem value="guest_otp">Guest (One-Time OTP)</SelectItem>
                    <SelectItem value="guest_longterm">Guest (Long Term)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
              </section>

              <Separator />

              {/* Permission preview */}
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Default Permissions</h3>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(ROLE_DEFAULTS[role]).map(([key, val]) => {
                    if (key === 'days_of_week' || key === 'time_restricted') return null
                    const label = key.replace(/_/g, ' ').replace(/^can /, '')
                    return (
                      <div key={key} className="flex items-center gap-1.5">
                        <Checkbox checked={!!val} disabled className="h-3 w-3" />
                        <span className="capitalize text-muted-foreground">{label}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">You can fine-tune permissions after adding the user.</p>
              </section>

              <Separator />

              {/* Access validity */}
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Access Validity (optional)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="add_valid_from" className="text-xs">Valid From</Label>
                    <Input
                      id="add_valid_from"
                      type="datetime-local"
                      value={accessValidFrom}
                      onChange={(e) => setAccessValidFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="add_valid_until" className="text-xs">Valid Until</Label>
                    <Input
                      id="add_valid_until"
                      type="datetime-local"
                      value={accessValidUntil}
                      onChange={(e) => setAccessValidUntil(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </>
          )}
        </div>

        {step === 'configure' && (
          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Adding...' : 'Add User'}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
