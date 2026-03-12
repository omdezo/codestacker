-- Enable pg_trgm extension for trigram-based similarity search
-- This allows ILIKE '%term%' queries to use GIN indexes instead of sequential scans
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- users: searched by firstName, lastName, email across staff and customer listings
CREATE INDEX IF NOT EXISTS idx_users_firstname_trgm  ON users USING gin("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_lastname_trgm   ON users USING gin("lastName"  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm      ON users USING gin(email       gin_trgm_ops);

-- branches: searched by name and location
CREATE INDEX IF NOT EXISTS idx_branches_name_trgm     ON branches USING gin(name     gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_branches_location_trgm ON branches USING gin(location gin_trgm_ops);

-- service_types: searched by name and description
CREATE INDEX IF NOT EXISTS idx_service_types_name_trgm ON service_types USING gin(name        gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_types_desc_trgm ON service_types USING gin(description gin_trgm_ops);

-- audit_logs: searched by action, actorRole, targetType
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_trgm      ON audit_logs USING gin(action        gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actorrole_trgm   ON audit_logs USING gin("actorRole"   gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_targettype_trgm  ON audit_logs USING gin("targetType"  gin_trgm_ops);

-- customers: searched by phone
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm ON customers USING gin(phone gin_trgm_ops);
