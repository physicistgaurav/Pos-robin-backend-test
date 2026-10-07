import { todo } from "node:test";
import { ProductModel } from "../models/Product.model";
import {
  CreateProductDTO,
  Product,
  ProductFilters,
  ProductStatus,
  UpdateProductDTO,
} from "../types/product.types";
import { ApiError } from "../utils/ApiError";
import { buildPaginationMeta, calculatePagination } from "../utils/helpers";
import { generateUniqueSlug } from "../utils/slug";
import { CategoryModel } from "../models/category.model";

export class ProductServices {
  
  static async getAll(filters: ProductFilters) {
    const {
      page = 1,
      limit = 10,
      category_id,
      status,
      slug,
      type,
      is_active,
      is_visible_in_menu,
      is_vegetarian,
      is_vegan,
      is_gluten_free,
      featured,
      is_bestseller,
      min_price,
      max_price,
      search,
    } = filters;

    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { products, total } = await ProductModel.findAll({
      limit: validatedLimit,
      offset,
      category_id,
      status,
      slug,
      type,
      is_active,
      is_visible_in_menu,
      is_vegetarian,
      is_vegan,
      is_gluten_free,
      featured,
      is_bestseller,
      min_price,
      max_price,
      search,
    });
    return {
      products,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  static async getById(id: string) {
    const product = ProductModel.findById(id);
    if (!product) {
      throw ApiError.notFound(`Product with ID ${id} not found`);
    }

    return product;
  }

  static async getPosMenu(query: {
    is_active?: boolean;
    include_empty?: boolean;
  }) {
    const { is_active = true, include_empty = false } = query;
    const hierarchy = await ProductModel.getPOSMenu({
      is_active,
      include_empty,
    });
    return hierarchy;
  }

  static async getLegacyPOSMenu(query: {
    categories?: string;
    search?: string;
  }) {
    const categoryIds = query.categories
      ? query.categories.split(",")
      : [];
  
    const search = query.search?.toLowerCase() || "";
  
    const hierarchy = await ProductModel.getPOSMenu({
      is_active: true,
      include_empty: false,
    });
  
    const transformed = hierarchy.flatMap((main: any) =>
      (main.subcategories || [])
        .filter((sub: any) =>
          categoryIds.length ? categoryIds.includes(sub.id) : true
        )
        .map((sub: any) => {
          const filteredProducts = (sub.products || []).filter((p: any) =>
            search ? p.name.toLowerCase().includes(search) : true
          );
  
          return {
            title: sub.name,
            order: sub.display_order,
            data: filteredProducts.map((p: any) => ({
              id: p.id,
              name: p.name,
              categoryId: sub.id,
              image: p.image_url,
              price: p.price,
              calories: 0,
              description: "",
              prepTime: 0,
              options: {},
              createdAt: null,
              updatedAt: null,
              category: {
                id: sub.id,
                name: sub.name,
                description: "",
                image: sub.image_url,
                order: sub.display_order,
                type: "DRINK",
                createdAt: null,
                updatedAt: null,
              },
            })),
          };
        })
        // ❗ remove empty categories after search
        .filter((group: any) => group.data.length > 0)
    );
  
    return transformed;
  }

  static async createProduct(payload: CreateProductDTO): Promise<Product> {
    const category = await CategoryModel.findById(payload.category_id);

    if (!category) {
      throw ApiError.badRequest("Invalid category");
    }

    if (category.type !== "sub") {
      throw ApiError.badRequest("Products must be assigned to a sub category");
    }

    // 1. Generate slug if not provided
    const slug = payload.slug
      ? payload.slug
      : await generateUniqueSlug(payload.name, ProductModel.existsBySlug);

    // 2. Price sanity check
    if (
      payload.compare_at_price &&
      payload.compare_at_price < payload.selling_price
    ) {
      throw ApiError.badRequest(
        "compare_at_price must be greater than selling_price"
      );
    }

    // 3. Create product
    const product = await ProductModel.create({
      ...payload,
      slug,
    });

    return product;
  }

  static async update(id: string, data: UpdateProductDTO) {
    // Slug should never be updated in POS
    if ("slug" in data) {
      delete (data as any).slug;
    }

    // Price sanity check
    if (
      data.compare_at_price !== undefined &&
      data.selling_price !== undefined &&
      data.compare_at_price < data.selling_price
    ) {
      throw ApiError.badRequest(
        "compare_at_price must be greater than selling_price"
      );
    }
    const updated = await ProductModel.update(id, data);

    if (!updated) {
      throw ApiError.notFound("Product not found");
    }

    return updated;
  }

  static async updateStatus(id: string, status: ProductStatus) {
    const updated = await ProductModel.updateStatus(id, status);
    if (!updated) {
      throw ApiError.notFound("Product not found");
    }
    return updated;
  }

  static async deactivate(id: string) {
    const product = await ProductModel.findById(id);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }

    todo;
    // Optional safety check
    // const hasOrders = await ProductModel.hasOrders(id);
    // if (hasOrders) {
    //   // Allowed but important business warning
    //   // We just hide it, not delete
    // }

    return ProductModel.softDelete(id);
  }

  static async reactivate(id: string) {
    const product = await ProductModel.findById(id);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }

    todo;
    // Optional safety check
    // const hasOrders = await ProductModel.hasOrders(id);
    // if (hasOrders) {
    //   // Allowed but important business warning
    //   // We just hide it, not delete
    // }

    return ProductModel.reactivate(id);
  }

  static async reorderProducts(
    category_id: string,
    items: { id: string; display_order: number }[]
  ): Promise<void> {
    if (!items || items.length === 0) return;

    // 1. Check duplicate display_order
    const orders = items.map((i) => i.display_order);
    if (new Set(orders).size !== orders.length) {
      throw ApiError.badRequest("Duplicate display_order values not allowed");
    }

    // 2. Fetch products & validate category ownership
    const products = await ProductModel.getByIds(items.map((i) => i.id));

    if (products.length !== items.length) {
      throw ApiError.badRequest("One or more products not found");
    }

    if (!products.every((p) => p.category_id === category_id)) {
      throw ApiError.badRequest(
        "All products must belong to the same category"
      );
    }

    // 3. Persist ordering
    await ProductModel.bulkUpdateDisplayOrder(items);
  }
}
