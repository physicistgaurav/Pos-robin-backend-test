-- Enums
CREATE TYPE product_status AS ENUM ('draft', 'active', 'inactive', 'out_of_stock');
CREATE TYPE product_type AS ENUM ('simple', 'variant', 'combo');

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    short_description VARCHAR(500),

    -- Category
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT, -- sub-category
    type product_type NOT NULL DEFAULT 'simple', -- simple, variant, combo
    status product_status NOT NULL DEFAULT 'active',

    -- Pricing
    selling_price DECIMAL(10,2) NOT NULL,
    compare_at_price DECIMAL(10,2),

        -- Food-specific
    prep_time INTEGER, -- in minutes
    cooking_time INTEGER, -- in minutes
    calories INTEGER,
    spice_level SMALLINT CHECK (spice_level BETWEEN 0 AND 5),
    is_vegetarian BOOLEAN DEFAULT FALSE,
    is_vegan BOOLEAN DEFAULT FALSE,
    is_gluten_free BOOLEAN DEFAULT FALSE,
    allergen_info TEXT[], -- Array of allergens
    ingredients TEXT[], -- Array of ingredients

    -- Display & Marketing
    featured BOOLEAN DEFAULT FALSE,
    is_bestseller BOOLEAN DEFAULT FALSE,
    is_new_arrival BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_visible_in_menu BOOLEAN DEFAULT TRUE,
    is_available_for_delivery BOOLEAN DEFAULT TRUE,
    is_available_for_pickup BOOLEAN DEFAULT TRUE,

    -- Images
    image_url TEXT,
    gallery_images TEXT[],
    thumbnail_url TEXT,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT products_selling_price_check CHECK (selling_price >= 0),
    CONSTRAINT products_display_order_check CHECK (display_order >= 0),
    CONSTRAINT products_prep_time_check CHECK (prep_time IS NULL OR prep_time >= 0),
    CONSTRAINT products_cooking_time_check CHECK (cooking_time IS NULL OR cooking_time >= 0),
    CONSTRAINT products_calories_check CHECK (calories IS NULL OR calories >= 0)
);

-- Indexes
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_active_visible ON products(is_active, is_visible_in_menu) WHERE is_active = TRUE AND is_visible_in_menu = TRUE;
CREATE INDEX idx_products_featured ON products(featured) WHERE featured = TRUE;
CREATE INDEX idx_products_created_at ON products(created_at);

-- Full-text search index
CREATE INDEX idx_products_search ON products USING gin(
    to_tsvector('english', 
        COALESCE(name, '') || ' ' || 
        COALESCE(description, '')
    )
);
