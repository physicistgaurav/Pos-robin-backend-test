import { query, transaction } from "../config/database";
import { Category, FindAllCategoryParams, FindAllCategoryParamsMobile } from "../types/category.types";
import { ApiError } from "../utils/ApiError";

export class CategoryModel {
  static async findAll(params: FindAllCategoryParams): Promise<{ categories: Category[]; total: number }> {
    
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

     // Base filters
     if (params.is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(params.is_active);
    }

    if (params.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(params.type);
    }

    if (params.search) {
      conditions.push(`
        to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')) 
        @@ plainto_tsquery('english', $${paramIndex++})
      `);
      values.push(params.search);
    }

    const whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    
    
    const countSql = `SELECT COUNT(*) FROM categories ${whereClause}`;
    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataSql = `SELECT * FROM categories 
    ${whereClause}
    ORDER BY parent_id ASC, display_order ASC, name ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    values.push(params.limit, params.offset);

    const result = await query(dataSql, values);

    return { categories: result.rows as Category[], total };
  }


  static async findAllMobile(params: FindAllCategoryParamsMobile): Promise<{ categories: Category[]; total: number }> {
    
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

     // Base filters
     if (params.is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(params.is_active);
    }

    if (params.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(params.type);
    }

    if (params.search) {
      conditions.push(`
        to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')) 
        @@ plainto_tsquery('english', $${paramIndex++})
      `);
      values.push(params.search);
    }

    const whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    
    
    const countSql = `SELECT COUNT(*) FROM categories ${whereClause}`;
    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataSql = `SELECT * FROM categories 
    ${whereClause}
    ORDER BY parent_id ASC, display_order ASC, name ASC
    `;
    // LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    // values.push(params.limit, params.offset);

    const result = await query(dataSql, values);

    return { categories: result.rows as Category[], total };
  }

  // CategoryModel
static async getHierarchy(params: {
  is_active?: boolean;
  include_empty?: boolean;
}) {
  const sql = `
    SELECT 
      main.id,
      main.name,
      main.type,
      main.parent_id,
      main.display_order,
      main.is_active,
      main.description,
      main.image_url,
      main.created_at,
      main.updated_at,

      COALESCE(
        json_agg(
          json_build_object(
            'id', sub.id,
            'name', sub.name,
            'type', sub.type,
            'parent_id', sub.parent_id,
            'display_order', sub.display_order,
            'is_active', sub.is_active,
            'description', sub.description,
            'image_url', sub.image_url,
            'created_at', sub.created_at,
            'updated_at', sub.updated_at
          )
          ORDER BY sub.display_order
        ) FILTER (WHERE sub.id IS NOT NULL),
        '[]'::json
      ) AS subcategories

    FROM categories main
    LEFT JOIN categories sub
      ON sub.parent_id = main.id
      AND sub.type = 'sub'
      AND ($1::boolean IS NULL OR sub.is_active = $1)

    WHERE main.type = 'main'
      AND ($1::boolean IS NULL OR main.is_active = $1)

    GROUP BY
      main.id,
      main.name,
      main.type,
      main.parent_id,
      main.display_order,
      main.is_active,
      main.description,
      main.image_url,
      main.created_at,
      main.updated_at

    ORDER BY main.display_order
  `;

  const result = await query(sql, [params.is_active ?? null]);
  const rows = result.rows;

  // Filter empty main categories in JS if include_empty is false
  if (!params.include_empty) {
    return rows.filter((row) => row.subcategories.length > 0);
  }

  return rows;
}

static async findById(id: string): Promise<any | null> {
  const sql = `
    SELECT 
      c.*,
      p.name AS parent_name
    FROM categories c
    LEFT JOIN categories p 
      ON c.parent_id = p.id
    WHERE c.id = $1
  `;

  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

  static async findByName(name: string): Promise<Category | null> {
    const sql = `SELECT * FROM categories where name = $1`;
    const result = await query(sql, [name]);
    return result.rows[0] || null;
  }

  static async getNextDisplayOrder(parentId: string | null): Promise<number> {
    const sql = `
      SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
      FROM categories
      WHERE parent_id IS NOT DISTINCT FROM $1
    `;
    const result = await query(sql, [parentId]);
    return Number(result.rows[0].next_order);
  }

  static async create(data: {
    name: string;
    type: "main" | "sub";
    parent_id: string | null;
    display_order: number;
    is_active: boolean;
    description: string | null;
    image_url: string | null;
  }): Promise<Category> {
    const sql = `
      INSERT INTO categories 
        (name, type, parent_id, display_order, is_active, description, image_url)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await query(sql, [
      data.name,
      data.type,
      data.parent_id,
      data.display_order,
      data.is_active,
      data.description || null,
      data?.image_url || null,
    ]);
    return result.rows[0];
  }

  static async update(
    id: string,
    data: Partial<
      Pick<Category, "name" | "is_active" | "description" | "image_url" | "parent_id">
    >
  ): Promise<Category> {
    const fields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${index++}`);
      values.push(data.name);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${index++}`);
      values.push(data.is_active);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(data.description || null);
    }
    if (data.image_url !== undefined) {
      fields.push(`image_url = $${index++}`);
      values.push(data.image_url || null);
    }
    if (data.parent_id !== undefined) {
      fields.push(`parent_id = $${index++}`);
      values.push(data.parent_id);
    }

    values.push(id); // for WHERE clause

    const sql = `
      UPDATE categories
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `;

    const result = await query(sql, values);
    if (result.rowCount === 0) {
      throw new Error("Category not found");
    }
    return result.rows[0];
  }


static async getByIdsAndParent(
  ids: string[],
  parent_id: string | null
): Promise<{ id: string; parent_id: string | null; type: string }[]> {
  const sql = `
    SELECT id, parent_id, type
    FROM categories
    WHERE id = ANY($1::uuid[])
      AND parent_id IS NOT DISTINCT FROM $2
  `;

  const result = await query(sql, [ids, parent_id]);
  return result.rows;
}

static async countByParent(parent_id: string | null): Promise<number> {
  const sql = `
    SELECT COUNT(*) FROM categories
    WHERE parent_id IS NOT DISTINCT FROM $1
  `;
  const result = await query(sql, [parent_id]);
  return parseInt(result.rows[0].count, 10);
}


static async bulkUpdateDisplayOrder(
  items: { id: string; display_order: number }[]
): Promise<void> {
  await transaction(async () => {
    const TEMP_OFFSET = 100000; // large enough to never collide with real orders

    // Phase 1: Shift to temp range to avoid unique constraint conflicts
    for (const item of items) {
      await query(
        `UPDATE categories SET display_order = $1, updated_at = NOW() WHERE id = $2`,
        [item.display_order + TEMP_OFFSET, item.id]
      );
    }

    // Phase 2: Set actual final values
    for (const item of items) {
      await query(
        `UPDATE categories SET display_order = $1, updated_at = NOW() WHERE id = $2`,
        [item.display_order, item.id]
      );
    }
  });
}


  static async getSubcategories(id: string) {
    const sql = `SELECT * FROM categories WHERE parent_id = $1 ORDER BY display_order`;
    const result = await query(sql, [id]);
    return result.rows;
  }

  static async hasChildren(categoryId: string): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM categories
      WHERE parent_id = $1
      LIMIT 1;
    `;

    const result = await query(sql, [categoryId]);
    return (result.rowCount ?? 0) > 0;
  }

  static async hasProducts(categoryId: string): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM products
      WHERE category_id = $1
      LIMIT 1;
    `;

    const result = await query(sql, [categoryId]);
    return (result.rowCount ?? 0) > 0;
  }

  static async reassignProducts(fromCategoryId: string, toCategoryId: string) {
    const sql = `
      UPDATE products
      SET category_id = $2,
          updated_at = NOW()
      WHERE category_id = $1;
    `;
    await query(sql, [fromCategoryId, toCategoryId]);
  }

  static async deactivateProducts(categoryId: string) {
    const sql = `
      UPDATE products
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE category_id = $1;
    `;
    await query(sql, [categoryId]);
  }

  static async deactivateChildren(
    parentId: string,
    options?: {
      deactivateProducts?: boolean;
    }
  ) {
    // Get all subcategories
    const subcategories = await CategoryModel.getSubcategories(parentId);

    // Handle products in subcategories if needed
    if (options?.deactivateProducts) {
      for (const subcat of subcategories) {
        console.log("to do later for all cat", subcat);
        // await CategoryModel.deactivateProducts(subcat.id);
      }
    }

    // Deactivate all subcategories
    const sql = `
      UPDATE categories
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE parent_id = $1;
    `;
    await query(sql, [parentId]);
  }

  static async softDelete(id: string) {
    const sql = `
      UPDATE categories
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  static async reactivateCategory(id: string) {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw ApiError.notFound(`Category with ID ${id} not found`);
    }

    // Check if parent is active (for subcategories)
    if (category.parent_id) {
      const parent = await CategoryModel.findById(category.parent_id);
      if (!parent?.is_active) {
        throw ApiError.badRequest(
          "Cannot reactivate: parent category is inactive"
        );
      }
    }

    const sql = `
      UPDATE categories
      SET is_active = TRUE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // In CategoryModel

  static async reactivateChildrenAndProducts(parentId: string) {
    // 1. Reactivate all direct subcategories
    await query(
      `
    UPDATE categories
    SET is_active = TRUE, updated_at = NOW()
    WHERE parent_id = $1 AND is_active = FALSE
    `,
      [parentId]
    );

    // 2. Reactivate products in the main category itself
    await query(
      `
    UPDATE products
    SET is_active = TRUE, updated_at = NOW()
    WHERE category_id = $1 AND is_active = FALSE
    `,
      [parentId]
    );

    // 3. Reactivate products in all subcategories (recursively)
    // Get all subcategory IDs
    const subResult = await query(
      `SELECT id FROM categories WHERE parent_id = $1`,
      [parentId]
    );

    for (const sub of subResult.rows) {
      await query(
        `
      UPDATE products
      SET is_active = TRUE, updated_at = NOW()
      WHERE category_id = $1 AND is_active = FALSE
      `,
        [sub.id]
      );
    }
  }

  static async getCategoryDetails(id: string) {
    // later
    // const sql = `
    //   SELECT
    //     c.*,
    //     COUNT(DISTINCT p.id) as product_count,
    //     COUNT(DISTINCT sc.id) as subcategory_count
    //   FROM categories c
    //   LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
    //   LEFT JOIN categories sc ON sc.parent_id = c.id AND sc.is_active = TRUE
    //   WHERE c.id = $1
    //   GROUP BY c.id;
    // `;
    const sql = `
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as product_count,
        COUNT(DISTINCT sc.id) as subcategory_count
      FROM categories c
      LEFT JOIN categories sc ON sc.parent_id = c.id AND sc.is_active = TRUE
      WHERE c.id = $1
      GROUP BY c.id;
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  }
}
