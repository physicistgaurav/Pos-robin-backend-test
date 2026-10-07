
-- ==================== src/database/migrations/001_create_users_table.sql ====================
-- Migration: Create users table for authentication and authorization
-- Context  : POS (Point of Sale) system
-- Purpose  : Store user credentials, roles, and account status
-- Notes    : Designed with future OTP (One-Time Password) support in mind


-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  -- --------------------------------------------------------------------------
  -- Primary Key
  -- --------------------------------------------------------------------------
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- --------------------------------------------------------------------------
  -- Authentication Fields
  -- --------------------------------------------------------------------------
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,

  -- --------------------------------------------------------------------------
  -- Optional Phone Number (for SMS OTP / contact)
  -- --------------------------------------------------------------------------
  phone_number VARCHAR(20) UNIQUE,

  -- --------------------------------------------------------------------------
  -- User Identity
  -- --------------------------------------------------------------------------
  full_name VARCHAR(255) NOT NULL,

  -- --------------------------------------------------------------------------
  -- Authorization
  -- --------------------------------------------------------------------------
  role VARCHAR(50) NOT NULL DEFAULT 'staff',

  -- --------------------------------------------------------------------------
  -- Account Status
  -- --------------------------------------------------------------------------
  is_active BOOLEAN NOT NULL DEFAULT true,


  -- --------------------------------------------------------------------------
  -- OTP Support
  -- --------------------------------------------------------------------------
  otp_enabled BOOLEAN NOT NULL DEFAULT false,
  otp_hash VARCHAR(255),
  otp_expires_at TIMESTAMP WITH TIME ZONE,
  otp_last_verified_at TIMESTAMP WITH TIME ZONE,

  -- --------------------------------------------------------------------------
  -- Audit / Activity Tracking
  -- Useful for security monitoring and reporting
  -- --------------------------------------------------------------------------
  last_login TIMESTAMP WITH TIME ZONE,


  -- --------------------------------------------------------------------------
  -- Timestamps
  -- created_at: record creation time
  -- updated_at: record last update time
  -- --------------------------------------------------------------------------
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- --------------------------------------------------------------------------
  -- Constraints
  -- --------------------------------------------------------------------------
  
  CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'staff', 'waiter', 'chef'))
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Fast lookup during login and user searches
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Useful for permission checks and role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Helps efficiently filter active users
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);