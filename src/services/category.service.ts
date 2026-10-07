import { CategoryModel } from "../models/category.model";
import {
  Category,
  CategoryFilters,
  CategoryFiltersMobile,
  CreateCategoryDTO,
  DeactivateOptions,
} from "../types/category.types";
import { ApiError } from "../utils/ApiError";
import { buildPaginationMeta, calculatePagination } from "../utils/helpers";

export class CategoryService {
  static async getAllCategories(filters: CategoryFilters) {
    const {
      page = 1,
      limit = 10,
      is_active,
      type,
      search,
    } = filters;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { categories, total } = await CategoryModel.findAll({
      limit: validatedLimit,
      offset,
      is_active,
      type,
      search

    });

    return {
      categories,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  static async getAllCategoriesMobile(filters: CategoryFiltersMobile) {
    const {
      is_active,
      type,
      search,
    } = filters;
    const { categories } = await CategoryModel.findAllMobile({
      is_active,
      type,
      search
    });

    return {
      categories,
    };
  }

  static async getCategoryById(id: string) {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw ApiError.notFound(`Category with ID ${id} not found`);
    }
    return category;
  }

  // false means dont include empty main categories
  static async getHierarchy(query: {
    is_active?: boolean;
    include_empty?: boolean;
  }) {
    const { is_active = true, include_empty = false } = query;
    const hierarchy = await CategoryModel.getHierarchy({
      is_active,
      include_empty,
    });
    return hierarchy;
  }

  static async getSubcategories(id: string) {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw ApiError.notFound(`Category with ID ${id} not found`);
    }
    const subcategories = await CategoryModel.getSubcategories(id);
    return subcategories;
  }

  static async createCategory(data: CreateCategoryDTO): Promise<Category> {
    // 1. Check name uniqueness
    const existing = await CategoryModel.findByName(data.name);
    if (existing) {
      throw ApiError.conflict(`Category with name ${data.name} already exists`);
    }

    // 2. Determine parent_id (null for main)
    const parentId = data.type === "main" ? null : data.parent_id;

    // 3. Validate parent exists and is a main category (only for sub)
    if (data.type === "sub" && parentId) {
      const parent = await CategoryModel.findById(parentId);
      if (!parent) {
        throw ApiError.badRequest("Parent category not found");
      }
      if (parent.type !== "main") {
        throw ApiError.badRequest('Parent category must be of type "main"');
      }
    }

    // 4. Auto-calculate next display_order for siblings
    const displayOrder = await CategoryModel.getNextDisplayOrder(
      parentId ?? null
    );

    // 5. Create the category
    return await CategoryModel.create({
      name: data.name,
      type: data.type,
      parent_id: parentId ?? null,
      display_order: displayOrder,
      is_active: data.is_active ?? true,
      description: data.description ?? null,
      image_url: data.image_url ?? null,
    });
  }

  static async updateCategory(
    id: string,
    data: { name?: string; is_active?: boolean; description?: string | null; parent_id?: string | null }
  ): Promise<Category> {
    // Check if category exists
    const existing = await CategoryModel.findById(id);
    if (!existing) {
      throw ApiError.notFound("Category not found");
    }

    // If name is being changed, check uniqueness
    if (data.name && data.name !== existing.name) {
      const nameTaken = await CategoryModel.findByName(data.name);
      if (nameTaken) {
        throw ApiError.conflict(
          `Category with name "${data.name}" already exists`
        );
      }
    }

    return await CategoryModel.update(id, data);
  }

  static async reorderCategories(
    parent_id: string | null,
    items: { id: string; display_order: number }[]
  ): Promise<void> {
    if (!items || items.length === 0) return;

    // Check for duplicate display_order
    const orders = items.map((i) => i.display_order);
    if (new Set(orders).size !== orders.length) {
      throw ApiError.badRequest("Duplicate display_order values not allowed");
    }

      // 2. Fetch & validate categories
  const categories = await CategoryModel.getByIdsAndParent(
    items.map(i => i.id),
    parent_id
  );

  if (categories.length !== items.length) {
    throw ApiError.badRequest(
      "One or more categories not found or parent mismatch"
    );
  }

  const siblingCount = await CategoryModel.countByParent(parent_id);
  if (siblingCount !== items.length) {
    throw ApiError.badRequest(
      "All categories under this parent must be included in reorder"
    );
}


    // 3. Enforce correct type
    if (parent_id === null) {
      if (!categories.every(c => c.type === "main")) {
        throw ApiError.badRequest("Only main categories can be reordered here");
      }
    } else {
      if (!categories.every(c => c.type === "sub")) {
        throw ApiError.badRequest("Only sub categories can be reordered here");
      }
    }

    await CategoryModel.bulkUpdateDisplayOrder(items);

  }

  static async deactivateCategory(
    id: string,
    options: DeactivateOptions = { action: "require-empty" }
  ) {
    // Find category
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw ApiError.notFound(`Category with ID ${id} not found`);
    }

    // Check if category is already inactive
    if (!category.is_active) {
      throw ApiError.badRequest("Category is already inactive");
    }

    // Check for products
    const hasProducts = await CategoryModel.hasProducts(id);

    if (hasProducts) {
      switch (options.action) {
        case "reassign": {
          // Validate target category
          const targetCategory = await CategoryModel.findById(
            options.targetCategoryId
          );
          if (!targetCategory) {
            throw ApiError.notFound(
              `Target category with ID ${options.targetCategoryId} not found`
            );
          }
          if (!targetCategory.is_active) {
            throw ApiError.badRequest("Target category must be active");
          }
          if (targetCategory.id === id) {
            throw ApiError.badRequest(
              "Cannot reassign products to the same category"
            );
          }

          // Reassign products
          await CategoryModel.reassignProducts(id, options.targetCategoryId);
          break;
        }

        case "deactivate": {
          // Deactivate all products in this category
          await CategoryModel.deactivateProducts(id);
          break;
        }

        case "require-empty": {
          throw ApiError.badRequest(
            "Category has active products. Please choose to either reassign or deactivate them."
          );
        }
      }
    }

    // Cascade deactivate subcategories
    const hasChildren = await CategoryModel.hasChildren(id);
    if (hasChildren) {
      // If deactivating products, also deactivate products in subcategories
      await CategoryModel.deactivateChildren(id, {
        deactivateProducts: options.action === "deactivate",
      });
    }

    // Soft delete the category
    return await CategoryModel.softDelete(id);
  }

  static async reactivateCategory(id: string) {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw ApiError.notFound(`Category with ID ${id} not found`);
    }

    if (category.is_active) {
      throw ApiError.badRequest("Category is already active");
    }

    // For subcategories: ensure parent is active
    if (category.parent_id) {
      const parent = await CategoryModel.findById(category.parent_id);
      if (!parent) {
        throw ApiError.badRequest("Parent category not found");
      }
      if (!parent.is_active) {
        throw ApiError.badRequest(
          "Cannot reactivate: parent category is inactive"
        );
      }
    }

    // For main categories: reactivate children + products
    if (category.type === "main") {
      await CategoryModel.reactivateChildrenAndProducts(id);
    }

    // Finally reactivate the category itself
    return await CategoryModel.reactivateCategory(id);
  }
}
