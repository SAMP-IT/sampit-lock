import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types based on database schema
export type UserRole = 'owner' | 'family' | 'guest' | 'service' | 'enterprise'
export type LockAction = 'unlocked' | 'locked' | 'failed_attempt' | 'auto_lock' | 'passage_mode' | 'battery_warning' | 'offline' | 'tamper_detected'
export type AccessMethodType = 'fingerprint' | 'pin' | 'phone' | 'card' | 'remote' | 'auto'
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
}

export interface UserLock {
  id: string
  user_id: string
  lock_id: string
  role: string
  can_unlock: boolean
  can_lock: boolean
  can_view_logs: boolean
  can_manage_users: boolean
  can_modify_settings: boolean
  remote_unlock_enabled: boolean
  time_restricted: boolean
  is_active: boolean
  created_at: string
  updated_at: string
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
