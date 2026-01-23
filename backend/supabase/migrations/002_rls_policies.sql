-- Awakey Smart Lock - Row Level Security Policies
-- Migration: 002_rls_policies
-- Description: Implements Row Level Security for all tables

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lock_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_diagnostics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Service role can manage all users
CREATE POLICY "Service role can manage all users"
    ON users FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- LOCKS TABLE POLICIES
-- ============================================================================

-- Users can view locks they have access to
CREATE POLICY "Users can view accessible locks"
    ON locks FOR SELECT
    USING (
        id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND is_active = TRUE
        )
    );

-- Lock owners can update their locks
CREATE POLICY "Owners can update locks"
    ON locks FOR UPDATE
    USING (owner_id = auth.uid());

-- Lock owners can delete their locks
CREATE POLICY "Owners can delete locks"
    ON locks FOR DELETE
    USING (owner_id = auth.uid());

-- Users can insert new locks (becoming the owner)
CREATE POLICY "Users can create locks"
    ON locks FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- ============================================================================
-- USER_LOCKS TABLE POLICIES
-- ============================================================================

-- Users can view their lock relationships
CREATE POLICY "Users can view their lock relationships"
    ON user_locks FOR SELECT
    USING (user_id = auth.uid());

-- Lock admins can view all users for their locks
CREATE POLICY "Lock admins can view all users"
    ON user_locks FOR SELECT
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
                AND can_manage_users = TRUE
        )
    );

-- Lock admins can insert new user relationships
CREATE POLICY "Lock admins can add users"
    ON user_locks FOR INSERT
    WITH CHECK (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
                AND can_manage_users = TRUE
        )
    );

-- Lock admins can update user permissions (except other admins)
CREATE POLICY "Lock admins can update user permissions"
    ON user_locks FOR UPDATE
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
                AND can_manage_users = TRUE
        )
        AND role != 'admin' -- Cannot modify other admins
    );

-- Lock admins can delete users (except other admins)
CREATE POLICY "Lock admins can remove users"
    ON user_locks FOR DELETE
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
                AND can_manage_users = TRUE
        )
        AND role != 'admin' -- Cannot remove other admins
    );

-- ============================================================================
-- USER_ACCESS_METHODS TABLE POLICIES
-- ============================================================================

-- Users can view their own access methods
CREATE POLICY "Users can view own access methods"
    ON user_access_methods FOR SELECT
    USING (
        user_lock_id IN (
            SELECT id
            FROM user_locks
            WHERE user_id = auth.uid()
        )
    );

-- Lock admins can view all access methods for their locks
CREATE POLICY "Lock admins can view all access methods"
    ON user_access_methods FOR SELECT
    USING (
        user_lock_id IN (
            SELECT ul.id
            FROM user_locks ul
            WHERE ul.lock_id IN (
                SELECT lock_id
                FROM user_locks
                WHERE user_id = auth.uid()
                    AND role = 'admin'
                    AND can_manage_users = TRUE
            )
        )
    );

-- Lock admins can manage access methods
CREATE POLICY "Lock admins can manage access methods"
    ON user_access_methods FOR ALL
    USING (
        user_lock_id IN (
            SELECT ul.id
            FROM user_locks ul
            WHERE ul.lock_id IN (
                SELECT lock_id
                FROM user_locks
                WHERE user_id = auth.uid()
                    AND role = 'admin'
                    AND can_manage_users = TRUE
            )
        )
    );

-- ============================================================================
-- ACTIVITY_LOGS TABLE POLICIES
-- ============================================================================

-- Users can view activity logs for locks they have access to
CREATE POLICY "Users can view activity for accessible locks"
    ON activity_logs FOR SELECT
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND is_active = TRUE
                AND can_view_logs = TRUE
        )
    );

-- System can insert activity logs (via service role or triggers)
CREATE POLICY "System can insert activity logs"
    ON activity_logs FOR INSERT
    WITH CHECK (TRUE); -- Allows system to log all activities

-- No updates or deletes allowed (audit trail)
-- Activity logs are immutable for data integrity

-- ============================================================================
-- ACCESS_CODES TABLE POLICIES
-- ============================================================================

-- Users can view codes for locks they have access to
CREATE POLICY "Users can view access codes for their locks"
    ON access_codes FOR SELECT
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND is_active = TRUE
        )
    );

-- Lock admins can create access codes
CREATE POLICY "Lock admins can create access codes"
    ON access_codes FOR INSERT
    WITH CHECK (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
        AND created_by_user_id = auth.uid()
    );

-- Lock admins can update/delete access codes they created
CREATE POLICY "Lock admins can manage their access codes"
    ON access_codes FOR ALL
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
        AND created_by_user_id = auth.uid()
    );

-- ============================================================================
-- INVITES TABLE POLICIES
-- ============================================================================

-- Users can view invites they sent
CREATE POLICY "Users can view invites they sent"
    ON invites FOR SELECT
    USING (invited_by_user_id = auth.uid());

-- Users can view invites sent to their email
CREATE POLICY "Users can view invites sent to them"
    ON invites FOR SELECT
    USING (email = auth.email());

-- Lock admins can create invites
CREATE POLICY "Lock admins can create invites"
    ON invites FOR INSERT
    WITH CHECK (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
                AND can_manage_users = TRUE
        )
        AND invited_by_user_id = auth.uid()
    );

-- Lock admins can update/revoke invites they sent
CREATE POLICY "Lock admins can manage their invites"
    ON invites FOR ALL
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
        AND invited_by_user_id = auth.uid()
    );

-- ============================================================================
-- GUEST_ACCESS TABLE POLICIES
-- ============================================================================

-- Users can view guest access for locks they manage
CREATE POLICY "Lock admins can view guest access"
    ON guest_access FOR SELECT
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
    );

-- Guests can view their own access schedules
CREATE POLICY "Guests can view their access schedules"
    ON guest_access FOR SELECT
    USING (user_id = auth.uid());

-- Lock admins can manage guest access
CREATE POLICY "Lock admins can manage guest access"
    ON guest_access FOR ALL
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
    );

-- ============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    USING (user_id = auth.uid());

-- System can create notifications
CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (TRUE);

-- ============================================================================
-- TRUSTED_CONTACTS TABLE POLICIES
-- ============================================================================

-- Users can view their own trusted contacts
CREATE POLICY "Users can view own trusted contacts"
    ON trusted_contacts FOR SELECT
    USING (user_id = auth.uid());

-- Users can manage their own trusted contacts
CREATE POLICY "Users can manage own trusted contacts"
    ON trusted_contacts FOR ALL
    USING (user_id = auth.uid());

-- ============================================================================
-- LOCK_SETTINGS TABLE POLICIES
-- ============================================================================

-- Users can view settings for locks they have access to
CREATE POLICY "Users can view lock settings"
    ON lock_settings FOR SELECT
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND is_active = TRUE
        )
    );

-- Lock admins with modify permissions can update settings
CREATE POLICY "Lock admins can update lock settings"
    ON lock_settings FOR ALL
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND role = 'admin'
                AND can_modify_settings = TRUE
        )
    );

-- ============================================================================
-- DEVICE_DIAGNOSTICS TABLE POLICIES
-- ============================================================================

-- Users can view diagnostics for locks they have access to
CREATE POLICY "Users can view device diagnostics"
    ON device_diagnostics FOR SELECT
    USING (
        lock_id IN (
            SELECT lock_id
            FROM user_locks
            WHERE user_id = auth.uid()
                AND is_active = TRUE
        )
    );

-- System can insert diagnostics
CREATE POLICY "System can insert diagnostics"
    ON device_diagnostics FOR INSERT
    WITH CHECK (TRUE);

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Function to check if user is lock admin
CREATE OR REPLACE FUNCTION is_lock_admin(p_lock_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_locks
        WHERE user_id = auth.uid()
            AND lock_id = p_lock_id
            AND role = 'admin'
            AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has lock access
CREATE OR REPLACE FUNCTION has_lock_access(p_lock_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_locks
        WHERE user_id = auth.uid()
            AND lock_id = p_lock_id
            AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLETION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 002_rls_policies completed successfully';
    RAISE NOTICE 'Row Level Security is now enabled and configured';
END $$;
