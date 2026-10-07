ALTER TABLE store_transactions 
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'voided')),
ADD COLUMN voided_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN voided_by UUID REFERENCES users(id),
ADD COLUMN void_reason TEXT,
ADD COLUMN voided_by_txn_id UUID REFERENCES store_transactions(id);