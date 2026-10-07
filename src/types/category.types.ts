export interface Category {
    id: string;
    name: string;
    type: 'main' | 'sub';
    parent_id: string | null;
    display_order: number;
    is_active: boolean;
    description: string | null;
    image_url: string | null;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface CategoryWithSubcategories extends Category {
    subcategories?: Category[];
  }
  
  export interface CreateCategoryDTO {
    name: string;
    type: 'main' | 'sub';
    parent_id?: string;
    display_order?: number;
    is_active?: boolean;
    description?: string;
    image_url?: string
  }
  
  export interface UpdateCategoryDTO {
    name?: string;
    parent_id?: string;
    display_order?: number;
    is_active?: boolean;
    description?: string;
    image_url?: string;
  }
  
  export type DeactivateOptions = 
  | { action: 'reassign'; targetCategoryId: string }
  | { action: 'deactivate' }
  | { action: 'require-empty' };

export interface DeactivateCategoryRequest {
  productAction?: 'reassign' | 'deactivate' | 'require-empty';
  targetCategoryId?: string;
}

export type CategoryType = 'main' | 'sub';


export interface CategoryFilters {
  page?: number;
  limit?: number;
  type?: CategoryType;
  is_active?: boolean;
  search?: string; // for full-text search on name/description
}

export interface CategoryFiltersMobile {
  type?: CategoryType;
  is_active?: boolean;
  search?: string; // for full-text search on name/description
}

export interface FindAllCategoryParams {
  limit: number;
  offset: number;
  type?: string;
  is_active?: boolean;
  search?: string;
}

export interface FindAllCategoryParamsMobile {
  type?: string;
  is_active?: boolean;
  search?: string;
}