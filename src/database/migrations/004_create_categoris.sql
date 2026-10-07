CREATE TYPE category_type AS ENUM ('main', 'sub');

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name VARCHAR(255) NOT NULL,
    type category_type NOT NULL,
    
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT uq_categories_name UNIQUE (name),
    CONSTRAINT uq_categories_parent_display UNIQUE (parent_id, display_order),  -- Per-parent ordering
    CONSTRAINT categories_parent_id_check CHECK (
        (type = 'main' AND parent_id IS NULL) OR 
        (type = 'sub' AND parent_id IS NOT NULL)
    ),
    CONSTRAINT categories_display_order_check CHECK (display_order >= 0)
);

-- Indexes
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_active_display ON categories(is_active, display_order) 
    WHERE is_active = TRUE;