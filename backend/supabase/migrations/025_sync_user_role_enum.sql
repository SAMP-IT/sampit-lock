-- ============================================================================
-- MIGRATION 025: Sync users.role enum with user_locks.role values (P5)
--
-- Current user_role enum: owner, family, guest, service, enterprise
-- user_locks.role values:  owner, admin, family, scheduled, guest_otp, guest_longterm
--
-- Strategy: Add missing values to user_role enum so both tables use
-- the same vocabulary. Keep existing values for backwards compatibility.
-- ============================================================================

-- Add 'admin' to user_role enum
DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'scheduled' to user_role enum
DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'scheduled';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'guest_otp' to user_role enum
DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest_otp';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'guest_longterm' to user_role enum
DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest_longterm';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Also add 'otp_verified' to lock_action enum (for OTP verification logging)
-- ============================================================================
DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE IF NOT EXISTS 'otp_verified';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Also add 'otp' to access_method_type enum
DO $$
BEGIN
  ALTER TYPE access_method_type ADD VALUE IF NOT EXISTS 'otp';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
