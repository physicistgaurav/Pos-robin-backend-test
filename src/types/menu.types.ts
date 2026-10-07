import { MENU_CATEGORY } from "../config/constants";

export type MenuCategory = (typeof MENU_CATEGORY)[keyof typeof MENU_CATEGORY];

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  category: MenuCategory;
  price: number;
  image_url?: string;
  is_available: boolean;
  preparation_time: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMenuItemDTO {
  name: string;
  description?: string;
  category: MenuCategory;
  price: number;
  image_url?: string;
  is_available?: boolean;
  preparation_time?: number;
}

export interface UpdateMenuItemDTO {
  name?: string;
  description?: string;
  category?: MenuCategory;
  price?: number;
  image_url?: string;
  is_available?: boolean;
  preparation_time?: number;
}

export interface MenuQueryParams {
  category?: MenuCategory;
  is_available?: boolean;
  min_price?: number;
  max_price?: number;
  search?: string;
}
