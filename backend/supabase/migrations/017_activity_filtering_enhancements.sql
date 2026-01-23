-- Migration: 017_activity_filtering_enhancements
-- Description: Enhance activity_logs for better filtering and sorting capabilities

-- Add composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_activity_logs_lock_action ON activity_logs(lock_id, action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_lock_user ON activity_logs(lock_id, user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_lock_method ON activity_logs(lock_id, access_method);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created ON activity_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_method_created ON activity_logs(access_method, created_at DESC);

-- Add index for success status filtering
CREATE INDEX IF NOT EXISTS idx_activity_logs_success ON activity_logs(success);

-- Create a view for activity with user and lock details (for efficient querying)
CREATE OR REPLACE VIEW activity_logs_detailed AS
SELECT
    al.id,
    al.lock_id,
    al.user_id,
    al.action,
    al.access_method,
    al.success,
    al.failure_reason,
    al.ip_address,
    al.metadata,
    al.created_at,
    l.name AS lock_name,
    l.location AS lock_location,
    u.first_name AS user_first_name,
    u.last_name AS user_last_name,
    u.email AS user_email,
    CONCAT(u.first_name, ' ', u.last_name) AS user_full_name
FROM activity_logs al
LEFT JOIN locks l ON al.lock_id = l.id
LEFT JOIN users u ON al.user_id = u.id;

-- Grant access to the view
COMMENT ON VIEW activity_logs_detailed IS 'Detailed activity logs with user and lock information for filtering';

-- Function to get activity statistics by date range
CREATE OR REPLACE FUNCTION get_activity_stats_by_range(
    p_lock_ids UUID[],
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    total_events BIGINT,
    unlock_count BIGINT,
    lock_count BIGINT,
    failed_count BIGINT,
    by_access_method JSONB,
    by_hour JSONB,
    by_day_of_week JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_events,
        COUNT(*) FILTER (WHERE action = 'unlocked')::BIGINT AS unlock_count,
        COUNT(*) FILTER (WHERE action = 'locked')::BIGINT AS lock_count,
        COUNT(*) FILTER (WHERE action = 'failed_attempt')::BIGINT AS failed_count,
        COALESCE(
            jsonb_object_agg(
                COALESCE(access_method::text, 'unknown'),
                method_count
            ) FILTER (WHERE access_method IS NOT NULL),
            '{}'::jsonb
        ) AS by_access_method,
        COALESCE(
            jsonb_object_agg(
                hour_of_day::text,
                hour_count
            ),
            '{}'::jsonb
        ) AS by_hour,
        COALESCE(
            jsonb_object_agg(
                day_of_week::text,
                day_count
            ),
            '{}'::jsonb
        ) AS by_day_of_week
    FROM (
        SELECT
            action,
            access_method,
            EXTRACT(HOUR FROM created_at) AS hour_of_day,
            EXTRACT(DOW FROM created_at) AS day_of_week
        FROM activity_logs
        WHERE lock_id = ANY(p_lock_ids)
        AND created_at >= p_start_date
        AND created_at <= p_end_date
    ) AS filtered_logs
    LEFT JOIN LATERAL (
        SELECT access_method AS am, COUNT(*) AS method_count
        FROM activity_logs
        WHERE lock_id = ANY(p_lock_ids)
        AND created_at >= p_start_date
        AND created_at <= p_end_date
        AND access_method IS NOT NULL
        GROUP BY access_method
    ) method_stats ON TRUE
    LEFT JOIN LATERAL (
        SELECT EXTRACT(HOUR FROM created_at) AS h, COUNT(*) AS hour_count
        FROM activity_logs
        WHERE lock_id = ANY(p_lock_ids)
        AND created_at >= p_start_date
        AND created_at <= p_end_date
        GROUP BY h
    ) hour_stats ON TRUE
    LEFT JOIN LATERAL (
        SELECT EXTRACT(DOW FROM created_at) AS d, COUNT(*) AS day_count
        FROM activity_logs
        WHERE lock_id = ANY(p_lock_ids)
        AND created_at >= p_start_date
        AND created_at <= p_end_date
        GROUP BY d
    ) day_stats ON TRUE;
END;
$$ LANGUAGE plpgsql;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 017_activity_filtering_enhancements completed successfully';
END $$;
