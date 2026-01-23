-- Awakey Smart Lock - Initial Database Schema
-- Migration: 001_initial_schema
-- Description: Creates all tables, indexes, and basic structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for location features (optional)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM ('owner', 'family', 'guest', 'service', 'enterprise');
CREATE TYPE lock_action AS ENUM ('unlocked', 'locked', 'failed_attempt', 'auto_lock', 'passage_mode', 'battery_warning', 'offline', 'tamper_detected');
CREATE TYPE access_method_type AS ENUM ('fingerprint', 'pin', 'phone', 'card', 'remote', 'auto');
CREATE TYPE code_type AS ENUM ('permanent', 'temporary', 'one_time');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'error');
CREATE TYPE motor_health AS ENUM ('good', 'degraded', 'failing', 'unknown');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'owner',
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    simple_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Locks table
CREATE TABLE locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200) NOT NULL,
    device_id VARCHAR(100) UNIQUE NOT NULL,
    mac_address VARCHAR(17),
    firmware_version VARCHAR(20),
    battery_level INTEGER DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
    is_locked BOOLEAN DEFAULT TRUE,
    is_connected BOOLEAN DEFAULT FALSE,
    is_online BOOLEAN DEFAULT FALSE,
    lock_type VARCHAR(50) DEFAULT 'smart_deadbolt',
    last_activity_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    paired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Lock relationship with permissions
CREATE TABLE user_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'family', 'guest')),
    can_unlock BOOLEAN DEFAULT TRUE,
    can_lock BOOLEAN DEFAULT TRUE,
    can_view_logs BOOLEAN DEFAULT TRUE,
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_modify_settings BOOLEAN DEFAULT FALSE,
    remote_unlock_enabled BOOLEAN DEFAULT TRUE,
    time_restricted BOOLEAN DEFAULT FALSE,
    time_restriction_start TIME,
    time_restriction_end TIME,
    days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
    access_valid_from TIMESTAMP WITH TIME ZONE,
    access_valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lock_id)
);

-- User access methods (fingerprint, PIN, phone, card)
CREATE TABLE user_access_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_lock_id UUID NOT NULL REFERENCES user_locks(id) ON DELETE CASCADE,
    method_type access_method_type NOT NULL,
    method_identifier VARCHAR(255),
    is_enabled BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action lock_action NOT NULL,
    access_method access_method_type,
    success BOOLEAN DEFAULT TRUE,
    failure_reason TEXT,
    ip_address INET,
    location_lat DECIMAL(10, 8),
    location_lon DECIMAL(11, 8),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Access codes (PIN codes for locks)
CREATE TABLE access_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    code_type code_type NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    max_usage_count INTEGER,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invites
CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invite_code VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('family', 'guest')),
    permissions JSONB NOT NULL,
    status invite_status DEFAULT 'pending',
    accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE
);

-- Guest access schedules
CREATE TABLE guest_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guest_name VARCHAR(100) NOT NULL,
    access_start TIMESTAMP WITH TIME ZONE NOT NULL,
    access_end TIMESTAMP WITH TIME ZONE NOT NULL,
    access_code VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lock_id UUID REFERENCES locks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity notification_severity DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Trusted contacts
CREATE TABLE trusted_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    relationship VARCHAR(50),
    can_emergency_unlock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lock settings
CREATE TABLE lock_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID UNIQUE NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    auto_lock_enabled BOOLEAN DEFAULT TRUE,
    auto_lock_delay INTEGER DEFAULT 5 CHECK (auto_lock_delay >= 0),
    remote_unlock_enabled BOOLEAN DEFAULT TRUE,
    passage_mode_enabled BOOLEAN DEFAULT FALSE,
    lock_sound_volume INTEGER DEFAULT 100 CHECK (lock_sound_volume >= 0 AND lock_sound_volume <= 100),
    lock_sound_enabled BOOLEAN DEFAULT TRUE,
    tamper_alert_enabled BOOLEAN DEFAULT TRUE,
    low_battery_threshold INTEGER DEFAULT 20 CHECK (low_battery_threshold >= 0 AND low_battery_threshold <= 100),
    offline_alert_enabled BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device diagnostics
CREATE TABLE device_diagnostics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    battery_voltage DECIMAL(5, 2),
    signal_strength INTEGER,
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    motor_health motor_health DEFAULT 'unknown',
    lock_jammed BOOLEAN DEFAULT FALSE,
    last_error_code VARCHAR(50),
    uptime_seconds BIGINT,
    total_operations INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Locks indexes
CREATE INDEX idx_locks_owner_id ON locks(owner_id);
CREATE INDEX idx_locks_device_id ON locks(device_id);
CREATE INDEX idx_locks_is_online ON locks(is_online);
CREATE INDEX idx_locks_battery_level ON locks(battery_level);

-- User-locks indexes
CREATE INDEX idx_user_locks_user_id ON user_locks(user_id);
CREATE INDEX idx_user_locks_lock_id ON user_locks(lock_id);
CREATE INDEX idx_user_locks_role ON user_locks(role);
CREATE INDEX idx_user_locks_is_active ON user_locks(is_active);

-- User access methods indexes
CREATE INDEX idx_access_methods_user_lock_id ON user_access_methods(user_lock_id);
CREATE INDEX idx_access_methods_type ON user_access_methods(method_type);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_lock_id ON activity_logs(lock_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_lock_created ON activity_logs(lock_id, created_at DESC);

-- Access codes indexes
CREATE INDEX idx_access_codes_lock_id ON access_codes(lock_id);
CREATE INDEX idx_access_codes_code ON access_codes(code);
CREATE INDEX idx_access_codes_is_active ON access_codes(is_active);
CREATE INDEX idx_access_codes_valid_dates ON access_codes(valid_from, valid_until);

-- Invites indexes
CREATE INDEX idx_invites_invite_code ON invites(invite_code);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invites_lock_id ON invites(lock_id);

-- Guest access indexes
CREATE INDEX idx_guest_access_lock_id ON guest_access(lock_id);
CREATE INDEX idx_guest_access_user_id ON guest_access(user_id);
CREATE INDEX idx_guest_access_dates ON guest_access(access_start, access_end);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_lock_id ON notifications(lock_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Trusted contacts indexes
CREATE INDEX idx_trusted_contacts_user_id ON trusted_contacts(user_id);

-- Lock settings indexes
CREATE INDEX idx_lock_settings_lock_id ON lock_settings(lock_id);

-- Device diagnostics indexes
CREATE INDEX idx_device_diagnostics_lock_id ON device_diagnostics(lock_id);
CREATE INDEX idx_device_diagnostics_created_at ON device_diagnostics(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locks_updated_at BEFORE UPDATE ON locks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_locks_updated_at BEFORE UPDATE ON user_locks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_access_methods_updated_at BEFORE UPDATE ON user_access_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_access_codes_updated_at BEFORE UPDATE ON access_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guest_access_updated_at BEFORE UPDATE ON guest_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trusted_contacts_updated_at BEFORE UPDATE ON trusted_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lock_settings_updated_at BEFORE UPDATE ON lock_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: User lock permissions with details
CREATE OR REPLACE VIEW user_lock_permissions_view AS
SELECT
    ul.id AS user_lock_id,
    u.id AS user_id,
    u.email,
    u.first_name,
    u.last_name,
    l.id AS lock_id,
    l.name AS lock_name,
    l.location AS lock_location,
    ul.role,
    ul.can_unlock,
    ul.can_lock,
    ul.can_view_logs,
    ul.can_manage_users,
    ul.can_modify_settings,
    ul.remote_unlock_enabled,
    ul.is_active
FROM user_locks ul
JOIN users u ON ul.user_id = u.id
JOIN locks l ON ul.lock_id = l.id;

-- View: Lock activity summary
CREATE OR REPLACE VIEW lock_activity_summary_view AS
SELECT
    l.id AS lock_id,
    l.name AS lock_name,
    COUNT(al.id) AS total_activities,
    COUNT(CASE WHEN al.action = 'unlocked' THEN 1 END) AS unlock_count,
    COUNT(CASE WHEN al.action = 'locked' THEN 1 END) AS lock_count,
    COUNT(CASE WHEN al.action = 'failed_attempt' THEN 1 END) AS failed_attempts,
    MAX(al.created_at) AS last_activity_at
FROM locks l
LEFT JOIN activity_logs al ON l.id = al.lock_id
GROUP BY l.id, l.name;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function: Generate random invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(100) AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result VARCHAR(100) := 'AWAKEY-';
    i INTEGER;
BEGIN
    FOR i IN 1..12 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
        IF i % 4 = 0 AND i < 12 THEN
            result := result || '-';
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate random access code
CREATE OR REPLACE FUNCTION generate_access_code()
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN lpad(floor(random() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function: Check user permission for lock
CREATE OR REPLACE FUNCTION check_user_lock_permission(
    p_user_id UUID,
    p_lock_id UUID,
    p_permission VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN;
BEGIN
    SELECT
        CASE p_permission
            WHEN 'unlock' THEN ul.can_unlock
            WHEN 'lock' THEN ul.can_lock
            WHEN 'view_logs' THEN ul.can_view_logs
            WHEN 'manage_users' THEN ul.can_manage_users
            WHEN 'modify_settings' THEN ul.can_modify_settings
            ELSE FALSE
        END INTO has_permission
    FROM user_locks ul
    WHERE ul.user_id = p_user_id
        AND ul.lock_id = p_lock_id
        AND ul.is_active = TRUE;

    RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function: Get user accessible locks
CREATE OR REPLACE FUNCTION get_user_accessible_locks(p_user_id UUID)
RETURNS TABLE (
    lock_id UUID,
    lock_name VARCHAR(100),
    lock_location VARCHAR(200),
    user_role VARCHAR(50),
    can_unlock BOOLEAN,
    can_lock BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.name,
        l.location,
        ul.role,
        ul.can_unlock,
        ul.can_lock
    FROM locks l
    JOIN user_locks ul ON l.id = ul.lock_id
    WHERE ul.user_id = p_user_id
        AND ul.is_active = TRUE
        AND l.is_online = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'Stores all user accounts with authentication and profile information';
COMMENT ON TABLE locks IS 'Stores smart lock devices information';
COMMENT ON TABLE user_locks IS 'Many-to-many relationship between users and locks with role-based permissions';
COMMENT ON TABLE activity_logs IS 'Records all lock access events and activities';
COMMENT ON TABLE access_codes IS 'Temporary or permanent access codes (PINs) for locks';
COMMENT ON TABLE invites IS 'User invitation system for lock access';
COMMENT ON TABLE guest_access IS 'Scheduled guest access windows with time restrictions';
COMMENT ON TABLE notifications IS 'User notifications and alerts';
COMMENT ON TABLE trusted_contacts IS 'Emergency contacts for users';
COMMENT ON TABLE lock_settings IS 'Lock configuration and settings';
COMMENT ON TABLE device_diagnostics IS 'Lock health and diagnostic data';

-- ============================================================================
-- INITIAL DATA (Optional - for development)
-- ============================================================================

-- Insert default lock settings template (commented out for production)
-- This can be used to initialize settings when a new lock is added

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 001_initial_schema completed successfully';
END $$;
