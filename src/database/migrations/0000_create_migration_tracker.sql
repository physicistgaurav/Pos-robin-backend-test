-- ==================== src/database/migrations/007_create_migration_tracker.sql ====================
-- Migration: Create migration tracking table
-- “Which database migrations have already been run?”
-- Created: 2024-01-01

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schema_migrations_name ON schema_migrations(migration_name);