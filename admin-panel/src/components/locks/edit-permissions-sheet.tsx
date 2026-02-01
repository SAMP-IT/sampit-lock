import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserLock, UserLockRole, User } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

type UserLockWithUser = UserLock & {
  users: Pick<User, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'avatar_url'>
}

interface EditPermissionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userLock: UserLockWithUser | null
  onSave: () => void
}

interface FormState {
  role: UserLockRole
  can_unlock: boolean
  can_lock: boolean
  remote_unlock_enabled: boolean
  can_view_logs: boolean
  can_view_all_logs: boolean
  can_manage_users: boolean
  can_modify_settings: boolean
  time_restricted: boolean
  time_restriction_start: string
  time_restriction_end: string
  days_of_week: number[]
  access_valid_from: string
  access_valid_until: string
  is_active: boolean
  vacation_disabled: boolean
  notes: string
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getInitialFormState(ul: UserLockWithUser | null): FormState {
  if (!ul) {
    return {
      role: 'guest_otp',
      can_unlock: true,
      can_lock: true,
      remote_unlock_enabled: true,
      can_view_logs: false,
      can_view_all_logs: false,
      can_manage_users: false,
      can_modify_settings: false,
      time_restricted: false,
      time_restriction_start: '',
      time_restriction_end: '',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      access_valid_from: '',
      access_valid_until: '',
      is_active: true,
      vacation_disabled: false,
      notes: '',
    }
  }

  return {
    role: ul.role,
    can_unlock: ul.can_unlock,
    can_lock: ul.can_lock,
    remote_unlock_enabled: ul.remote_unlock_enabled,
    can_view_logs: ul.can_view_logs,
    can_view_all_logs: ul.can_view_all_logs ?? false,
    can_manage_users: ul.can_manage_users,
    can_modify_settings: ul.can_modify_settings,
    time_restricted: ul.time_restricted,
    time_restriction_start: ul.time_restriction_start || '',
    time_restriction_end: ul.time_restriction_end || '',
    days_of_week: ul.days_of_week || [0, 1, 2, 3, 4, 5, 6],
    access_valid_from: ul.access_valid_from ? ul.access_valid_from.slice(0, 16) : '',
    access_valid_until: ul.access_valid_until ? ul.access_valid_until.slice(0, 16) : '',
    is_active: ul.is_active,
    vacation_disabled: ul.vacation_disabled ?? false,
    notes: ul.notes || '',
  }
}

export function EditPermissionsSheet({ open, onOpenChange, userLock, onSave }: EditPermissionsSheetProps) {
  const [form, setForm] = useState<FormState>(getInitialFormState(null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userLock) {
      setForm(getInitialFormState(userLock))
      setError(null)
    }
  }, [userLock])

  function updateForm(updates: Partial<FormState>) {
    setForm(prev => ({ ...prev, ...updates }))
  }

  function toggleDay(day: number) {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort(),
    }))
  }

  async function handleSave() {
    if (!userLock) return
    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('user_locks')
        .update({
          role: form.role,
          can_unlock: form.can_unlock,
          can_lock: form.can_lock,
          remote_unlock_enabled: form.remote_unlock_enabled,
          can_view_logs: form.can_view_logs,
          can_view_all_logs: form.can_view_all_logs,
          can_manage_users: form.can_manage_users,
          can_modify_settings: form.can_modify_settings,
          time_restricted: form.time_restricted,
          time_restriction_start: form.time_restriction_start || null,
          time_restriction_end: form.time_restriction_end || null,
          days_of_week: form.days_of_week,
          access_valid_from: form.access_valid_from || null,
          access_valid_until: form.access_valid_until || null,
          is_active: form.is_active,
          vacation_disabled: form.vacation_disabled,
          notes: form.notes || null,
        })
        .eq('id', userLock.id)

      if (updateError) throw updateError
      onSave()
    } catch (err) {
      console.error('Error updating permissions:', err)
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (!userLock) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit Access — {userLock.users?.first_name} {userLock.users?.last_name}</SheetTitle>
          <SheetDescription>{userLock.users?.email}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          {/* Role */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Role</h3>
            <Select value={form.role} onValueChange={(v) => updateForm({ role: v as UserLockRole })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="family">Family</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="guest_otp">Guest (One-Time)</SelectItem>
                <SelectItem value="guest_longterm">Guest (Long Term)</SelectItem>
              </SelectContent>
            </Select>
          </section>

          <Separator />

          {/* Basic Access */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Basic Access</h3>
            <CheckboxField
              id="can_unlock"
              label="Can Unlock"
              checked={form.can_unlock}
              onCheckedChange={(v) => updateForm({ can_unlock: !!v })}
            />
            <CheckboxField
              id="can_lock"
              label="Can Lock"
              checked={form.can_lock}
              onCheckedChange={(v) => updateForm({ can_lock: !!v })}
            />
            <CheckboxField
              id="remote_unlock"
              label="Remote Unlock"
              checked={form.remote_unlock_enabled}
              onCheckedChange={(v) => updateForm({ remote_unlock_enabled: !!v })}
            />
          </section>

          <Separator />

          {/* Management Permissions */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Management</h3>
            <CheckboxField
              id="can_view_logs"
              label="View Activity Logs"
              checked={form.can_view_logs}
              onCheckedChange={(v) => updateForm({ can_view_logs: !!v })}
            />
            <CheckboxField
              id="can_view_all_logs"
              label="View All Logs"
              checked={form.can_view_all_logs}
              onCheckedChange={(v) => updateForm({ can_view_all_logs: !!v })}
            />
            <CheckboxField
              id="can_manage_users"
              label="Manage Users"
              checked={form.can_manage_users}
              onCheckedChange={(v) => updateForm({ can_manage_users: !!v })}
            />
            <CheckboxField
              id="can_modify_settings"
              label="Modify Lock Settings"
              checked={form.can_modify_settings}
              onCheckedChange={(v) => updateForm({ can_modify_settings: !!v })}
            />
          </section>

          <Separator />

          {/* Time Restrictions */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Time Restrictions</h3>
            <CheckboxField
              id="time_restricted"
              label="Enable Time Restrictions"
              checked={form.time_restricted}
              onCheckedChange={(v) => updateForm({ time_restricted: !!v })}
            />
            {form.time_restricted && (
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="time_start" className="text-xs">Start Time</Label>
                    <Input
                      id="time_start"
                      type="time"
                      value={form.time_restriction_start}
                      onChange={(e) => updateForm({ time_restriction_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="time_end" className="text-xs">End Time</Label>
                    <Input
                      id="time_end"
                      type="time"
                      value={form.time_restriction_end}
                      onChange={(e) => updateForm({ time_restriction_end: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Days of Week</Label>
                  <div className="flex flex-wrap gap-1">
                    {DAY_LABELS.map((day, index) => (
                      <Button
                        key={day}
                        type="button"
                        variant={form.days_of_week.includes(index) ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 w-10 text-xs"
                        onClick={() => toggleDay(index)}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* Access Validity */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Access Validity</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="valid_from" className="text-xs">Valid From</Label>
                <Input
                  id="valid_from"
                  type="datetime-local"
                  value={form.access_valid_from}
                  onChange={(e) => updateForm({ access_valid_from: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="valid_until" className="text-xs">Valid Until</Label>
                <Input
                  id="valid_until"
                  type="datetime-local"
                  value={form.access_valid_until}
                  onChange={(e) => updateForm({ access_valid_until: e.target.value })}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Status */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Status</h3>
            <CheckboxField
              id="is_active"
              label="Active"
              checked={form.is_active}
              onCheckedChange={(v) => updateForm({ is_active: !!v })}
            />
            <CheckboxField
              id="vacation_disabled"
              label="Vacation Mode Disabled"
              checked={form.vacation_disabled}
              onCheckedChange={(v) => updateForm({ vacation_disabled: !!v })}
            />
          </section>

          <Separator />

          {/* Notes */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Notes</h3>
            <Textarea
              placeholder="e.g., Cleaning service — Mondays and Thursdays"
              value={form.notes}
              onChange={(e) => updateForm({ notes: e.target.value })}
              rows={3}
            />
          </section>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function CheckboxField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean | 'indeterminate') => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
        {label}
      </Label>
    </div>
  )
}
