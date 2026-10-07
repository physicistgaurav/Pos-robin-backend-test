-- Migration: Create tables for restaurant table management

CREATE TYPE table_status AS ENUM (
    'available',
    'occupied',
    'reserved',
    'cleaning',
    'out_of_service'
);

CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    table_number INTEGER NOT NULL,
    table_name VARCHAR(20),

    capacity SMALLINT NOT NULL,

    status table_status NOT NULL DEFAULT 'available',

    location VARCHAR(100),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tables_table_number UNIQUE (table_number),
    CONSTRAINT tables_capacity_check CHECK (capacity > 0 and capacity <50)
    );

CREATE INDEX idx_tables_status ON tables(status);
CREATE INDEX idx_tables_table_name ON tables(table_name);