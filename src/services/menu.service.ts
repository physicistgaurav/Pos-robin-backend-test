import { MenuModel } from "../models/menu.model";
import {
  MenuItem,
  CreateMenuItemDTO,
  UpdateMenuItemDTO,
  MenuQueryParams,
} from "../types/menu.types";
import { ApiError } from "../utils/ApiError";
import { calculatePagination, buildPaginationMeta } from "../utils/helpers";

export class MenuService {
  static async createMenuItem(data: CreateMenuItemDTO): Promise<MenuItem> {
    return await MenuModel.create(data);
  }

  static async getMenuItemById(id: number): Promise<MenuItem> {
    const menuItem = await MenuModel.findById(id);
    if (!menuItem) {
      throw ApiError.notFound(`Menu item with ID ${id} not found`);
    }
    return menuItem;
  }

  static async getAllMenuItems(
    query: MenuQueryParams & { page?: number; limit?: number }
  ) {
    const { page = 1, limit = 10, ...filters } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { items, total } = await MenuModel.findAll({
      ...filters,
      limit: validatedLimit,
      offset,
    });

    return {
      items,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  static async updateMenuItem(
    id: number,
    data: UpdateMenuItemDTO
  ): Promise<MenuItem> {
    const exists = await MenuModel.findById(id);
    if (!exists) {
      throw ApiError.notFound(`Menu item with ID ${id} not found`);
    }

    const updated = await MenuModel.update(id, data);
    if (!updated) {
      throw ApiError.internal("Failed to update menu item");
    }

    return updated;
  }

  static async deleteMenuItem(id: number): Promise<void> {
    const exists = await MenuModel.findById(id);
    if (!exists) {
      throw ApiError.notFound(`Menu item with ID ${id} not found`);
    }

    const deleted = await MenuModel.delete(id);
    if (!deleted) {
      throw ApiError.internal("Failed to delete menu item");
    }
  }
}
