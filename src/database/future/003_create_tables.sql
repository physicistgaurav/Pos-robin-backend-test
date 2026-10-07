# NOTE: To run when needed

-- -- ==================== src/database/migrations/002_create_tables.sql ====================
-- -- Migration: Create tables for restaurant table management
-- -- Created: 2024-01-01

-- CREATE TABLE IF NOT EXISTS tables (
--   id SERIAL PRIMARY KEY,
--   table_number VARCHAR(20) UNIQUE NOT NULL,
--   capacity INTEGER NOT NULL,
--   status VARCHAR(20) DEFAULT 'available',
--   location VARCHAR(100),
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
--   CONSTRAINT tables_capacity_check CHECK (capacity > 0 AND capacity <= 50),
--   CONSTRAINT tables_status_check CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning'))
-- );

-- CREATE INDEX idx_tables_status ON tables(status);
-- CREATE INDEX idx_tables_table_number ON tables(table_number);