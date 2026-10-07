// Enums matching the PostgreSQL ENUM types
export type ProductStatus = 'draft' | 'active' | 'inactive' | 'out_of_stock';
export type ProductType = 'simple' | 'variant' | 'combo';
export type DepartmentType = 'kitchen' | 'bar'

export interface Product {
  id: string;

  // Basic Info
  name: string;
  slug: string;
  description?: string;
  short_description?: string;

  // Category, type and status
  category_id: string;
  type: ProductType;
  status: ProductStatus;
  department?: DepartmentType;

  // Pricing
  selling_price: number;
  compare_at_price?: number;

  // Food-specific
  prep_time?: number;        // in minutes
  cooking_time?: number;     // in minutes
  calories?: number;
  spice_level?: number;      // 0–5
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  allergen_info?: string[];  // array of allergens
  ingredients?: string[];    // array of ingredients

  // Display & Marketing
  featured: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  display_order: number;
  is_active: boolean;
  is_visible_in_menu: boolean;
  is_available_for_delivery: boolean;
  is_available_for_pickup: boolean;

  // Images
  image_url?: string;
  gallery_images?: string[];
  thumbnail_url?: string;

  // Audit
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface CreateProductDTO {
    // Required
    name: string;
    category_id: string;
    selling_price: number;
  
    // Optional (auto / defaults)
    slug?: string;
    description?: string;
    short_description?: string;
    type?: ProductType;        // default: simple
    status?: ProductStatus;    // default: active
    compare_at_price?: number;
  
    // Food-specific
    prep_time?: number;
    cooking_time?: number;
    calories?: number;
    spice_level?: number;
    is_vegetarian?: boolean;
    is_vegan?: boolean;
    is_gluten_free?: boolean;
    allergen_info?: string[];
    ingredients?: string[];
  
    // Display & Marketing
    featured?: boolean;
    is_bestseller?: boolean;
    is_new_arrival?: boolean;
    display_order?: number;
    is_active?: boolean;
    is_visible_in_menu?: boolean;
    is_available_for_delivery?: boolean;
    is_available_for_pickup?: boolean;
  
    // Images
    image_url?: string;
    gallery_images?: string[];
    thumbnail_url?: string;
    department?: DepartmentType;
    is_inventory_tracked?: boolean;
  }
  


export interface UpdateProductDTO extends Partial<CreateProductDTO> {
  // You can add specific overrides here if needed
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  category_id?: string;
  status?: ProductStatus; // active, inactive, out_of_stock 
  slug?: string;
  type?: ProductType;
  is_active?: boolean;
  is_visible_in_menu?: boolean;
  is_available_for_delivery?: boolean;
  is_available_for_pickup?: boolean;
  featured?: boolean;
  is_bestseller?: boolean;
  is_new_arrival?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  min_price?: number;
  max_price?: number;
  search?: string; // for full-text search on name/description
}


export interface FindAllProductParams {
    limit: number;
    offset: number;
    category_id?: string;
    status?: string;
    slug?: string;
    type?: string;
    is_active?: boolean;
    is_visible_in_menu?: boolean;
    is_vegetarian?: boolean;
    is_vegan?: boolean;
    is_gluten_free?: boolean;
    featured?: boolean;
    is_bestseller?: boolean;
    min_price?: number;
    max_price?: number;
    search?: string;
  }