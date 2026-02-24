import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types based on database schema
export type UserRole = 'owner' | 'admin' | 'family' | 'guest' | 'scheduled' | 'guest_otp' | 'guest_longterm' | 'service' | 'enterprise'
export type UserLockRole = 'owner' | 'admin' | 'family' | 'scheduled' | 'guest_otp' | 'guest_longterm'
export type LockAction = 'unlocked' | 'locked' | 'failed_attempt' | 'auto_lock' | 'passage_mode' | 'battery_warning' | 'offline' | 'tamper_detected' | 'otp_verified'
export type AccessMethodType = 'fingerprint' | 'pin' | 'phone' | 'card' | 'remote' | 'auto' | 'otp'
export type CodeType = 'permanent' | 'temporary' | 'one_time'
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  role: UserRole
  avatar_url?: string
  email_verified: boolean
  is_active: boolean
  simple_mode: boolean
  created_at: string
  updated_at: string
  last_login_at?: string
}

export interface Lock {
  id: string
  owner_id: string
  name: string
  location: string
  device_id: string
  mac_address?: string
  firmware_version?: string
  battery_level: number
  is_locked: boolean
  is_connected: boolean
  is_online: boolean
  lock_type: string
  last_activity_at?: string
  last_sync_at?: string
  paired_at: string
  created_at: string
  updated_at: string
  // TTLock fields
  ttlock_lock_id?: number
  ttlock_mac?: string
  ttlock_lock_name?: string
  has_gateway?: boolean
  lock_alias?: string
  is_bluetooth_paired?: boolean
  lock_state?: string
}

export interface UserLock {
  id: string
  user_id: string
  lock_id: string
  role: UserLockRole
  // Core permissions
  can_unlock: boolean
  can_lock: boolean
  can_view_logs: boolean
  can_manage_users: boolean
  can_modify_settings: boolean
  remote_unlock_enabled: boolean
  // Extended permissions
  can_view_all_logs: boolean
  // Time restrictions
  time_restricted: boolean
  time_restriction_start?: string
  time_restriction_end?: string
  days_of_week: number[]
  // Access validity
  access_valid_from?: string
  access_valid_until?: string
  // Status
  is_active: boolean
  vacation_disabled: boolean
  notes?: string
  credentials_cleanup_status?: string | null
  // Timestamps
  created_at: string
  updated_at: string
  // Joined fields
  users?: Pick<User, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'avatar_url'>
  locks?: Pick<Lock, 'id' | 'name' | 'location'>
}

export interface ActivityLog {
  id: string
  lock_id: string
  user_id?: string
  action: LockAction
  access_method?: AccessMethodType
  success: boolean
  failure_reason?: string
  ip_address?: string
  metadata?: Record<string, unknown>
  created_at: string
  // Joined fields
  user?: User
  users?: Pick<User, 'first_name' | 'last_name'>
  lock?: Lock
}

export interface AccessCode {
  id: string
  lock_id: string
  created_by_user_id: string
  code: string
  code_type: CodeType
  is_active: boolean
  usage_count: number
  max_usage_count?: number
  valid_from: string
  valid_until?: string
  name?: string
  created_at: string
  updated_at: string
  // Joined fields
  lock?: Lock
}

export type SyncStatus = 'synced' | 'pending_add' | 'pending_delete' | 'pending_update' | 'failed' | 'unknown'

export interface Fingerprint {
  id: string
  lock_id: string
  user_id?: string
  ttlock_fingerprint_id?: number
  fingerprint_number: string
  fingerprint_name?: string
  fingerprint_type: number // 1=Normal, 4=Cyclic
  start_date?: string
  end_date?: string
  cyclic_config?: Record<string, unknown>[]
  status: number // 1=Normal, 2=Invalid, 3=Pending, 4=Adding, 5=Add Failed, 6=Modifying, 7=Modify Failed, 8=Deleting, 9=Delete Failed
  is_active?: boolean
  valid_from?: string
  valid_until?: string
  sync_status?: SyncStatus
  sync_error?: string
  last_synced_at?: string
  created_at: string
  updated_at: string
  // Joined fields
  users?: Pick<User, 'first_name' | 'last_name'>
}

export interface ICCard {
  id: string
  lock_id: string
  user_id?: string
  ttlock_card_id?: number
  card_number: string
  card_name?: string
  start_date?: string
  end_date?: string
  status: number
  is_active?: boolean
  valid_from?: string
  valid_until?: string
  sync_status?: SyncStatus
  sync_error?: string
  last_synced_at?: string
  created_at: string
  updated_at: string
  // Joined fields
  users?: Pick<User, 'first_name' | 'last_name'>
}

export interface Passcode {
  id: string
  lock_id: string
  code: string
  code_type: string
  valid_from?: string
  valid_until?: string
  is_active: boolean
  created_by?: string
  name?: string
  assigned_to_user_id?: string
  sync_status?: SyncStatus
  sync_error?: string
  last_synced_at?: string
  created_at: string
  updated_at: string
  // Joined fields
  users?: Pick<User, 'first_name' | 'last_name'>
}

export interface LockSettings {
  id: string
  lock_id: string
  auto_lock_enabled: boolean
  auto_lock_delay: number
  remote_unlock_enabled: boolean
  passage_mode_enabled: boolean
  lock_sound_enabled?: boolean
  lock_sound_volume?: number
  tamper_alert_enabled: boolean
  low_battery_threshold: number
  offline_alert_enabled?: boolean
  timezone?: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  lock_id?: string
  type: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'error'
  is_read: boolean
  action_url?: string
  metadata?: Record<string, unknown>
  created_at: string
  read_at?: string
}
