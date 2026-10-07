import { pool, query, transaction } from "../config/database";
import {
  CreateProductDTO,
  FindAllProductParams,
  Product,
  ProductStatus,
  UpdateProductDTO,
} from "../types/product.types";

export class ProductModel {

  static async findAll(
    params: FindAllProductParams
  ): Promise<{ products: Product[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Base filters
    if (params.is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(params.is_active);
    }

    if (params.is_visible_in_menu !== undefined) {
      conditions.push(`is_visible_in_menu = $${paramIndex++}`);
      values.push(params.is_visible_in_menu);
    }

    if (params.category_id) {
      conditions.push(`category_id = $${paramIndex++}`);
      values.push(params.category_id);
    }

    if (params.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }

    if (params.slug) {
      conditions.push(`slug = $${paramIndex++}`);
      values.push(params.slug);
    }

    if (params.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(params.type);
    }

    if (params.featured !== undefined) {
      conditions.push(`featured = $${paramIndex++}`);
      values.push(params.featured);
    }

    if (params.is_bestseller !== undefined) {
      conditions.push(`is_bestseller = $${paramIndex++}`);
      values.push(params.is_bestseller);
    }

    if (params.is_vegetarian !== undefined) {
      conditions.push(`is_vegetarian = $${paramIndex++}`);
      values.push(params.is_vegetarian);
    }

    if (params.is_vegan !== undefined) {
      conditions.push(`is_vegan = $${paramIndex++}`);
      values.push(params.is_vegan);
    }

    if (params.is_gluten_free !== undefined) {
      conditions.push(`is_gluten_free = $${paramIndex++}`);
      values.push(params.is_gluten_free);
    }

    if (params.min_price !== undefined) {
      conditions.push(`selling_price >= $${paramIndex++}`);
      values.push(params.min_price);
    }

    if (params.max_price !== undefined) {
      conditions.push(`selling_price <= $${paramIndex++}`);
      values.push(params.max_price);
    }

    if (params.search) {
      conditions.push(`(
        to_tsvector('english', COALESCE(name,'') || ' ' || COALESCE(description,'')) 
        @@ plainto_tsquery('english', $${paramIndex})
        OR name ILIKE $${paramIndex + 1}
      )`);
      
      values.push(params.search, `%${params.search}%`);
      paramIndex += 2;
}

    const whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // Count query
    const countSql = `SELECT COUNT(*) FROM products ${whereClause}`;
    const countResult = await query(countSql, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Data query
    const dataSql = `
      SELECT * FROM products 
      ${whereClause}
      ORDER BY display_order ASC, name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    values.push(params.limit, params.offset);

    const result = await query(dataSql, values);

    return { products: result.rows as Product[], total };
  }

  static async findById(id: string): Promise<ProductSnapshot | null>;
  static async findById(client: any, id: string): Promise<ProductSnapshot | null>;
  static async findById(clientOrId: any, id?: string): Promise<ProductSnapshot | null> {
    const client = id === undefined
      ? { query: async (sql: string, params?: any[]) => pool.query(sql, params) }
      : clientOrId;

    const productId = id === undefined ? clientOrId : id;
    const sql = `SELECT * FROM products WHERE id = $1`;
    const product = client.query(sql, [productId]);
    return (await product).rows[0] || null;
  }

  static async getPOSMenu(params: {
    is_active?: boolean;
    include_empty?: boolean;
  }) {
    const sql = `
  SELECT
    main.id,
    main.name,
    main.type,
    main.display_order,
    main.is_active,
    main.image_url,
  
    COALESCE(
      json_agg(
        json_build_object(
          'id', sub.id,
          'name', sub.name,
          'type', sub.type,
          'display_order', sub.display_order,
          'is_active', sub.is_active,
          'image_url', sub.image_url,
  
          'products', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', p.id,
                  'name', p.name,
                  'price', p.selling_price,
                  'status', p.status,
                  'image_url', p.image_url,
                  'is_vegetarian', p.is_vegetarian,
                  'spice_level', p.spice_level,
                  'display_order', p.display_order
                )
                ORDER BY p.display_order
              )
              FROM products p
              WHERE p.category_id = sub.id
                AND ($1::boolean IS NULL OR p.is_active = $1)
                AND p.is_visible_in_menu = true
            ),
            '[]'::json
          )
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
  
  GROUP BY main.id
  
  HAVING
    $2::boolean = TRUE
    OR COUNT(sub.id) > 0
  
  ORDER BY main.display_order;
    `;

    const result = await query(sql, [
      params.is_active ?? null,
      params.include_empty ?? true,
    ]);

    return result.rows;
  }

  static async create(payload: CreateProductDTO & { slug: string }) {
    const sql = `
      INSERT INTO products (
        name,
        slug,
        description,
        short_description,
        category_id,
        type,
        status,
        selling_price,
        compare_at_price,
        prep_time,
        cooking_time,
        calories,
        spice_level,
        is_vegetarian,
        is_vegan,
        is_gluten_free,
        allergen_info,
        ingredients,
        featured,
        is_bestseller,
        is_new_arrival,
        display_order,
        is_active,
        is_visible_in_menu,
        is_available_for_delivery,
        is_available_for_pickup,
        image_url,
        gallery_images,
        thumbnail_url,
        department,
        is_inventory_tracked
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,
        $24,$25,$26,$27,$28, $29, $30, $31
      )
      RETURNING *;
    `;

    const values = [
      payload.name,
      payload.slug,
      payload.description ?? null,
      payload.short_description ?? null,
      payload.category_id,
      payload.type ?? "simple",
      payload.status ?? "active",
      payload.selling_price,
      payload.compare_at_price ?? null,
      payload.prep_time ?? null,
      payload.cooking_time ?? null,
      payload.calories ?? null,
      payload.spice_level ?? null,
      payload.is_vegetarian ?? false,
      payload.is_vegan ?? false,
      payload.is_gluten_free ?? false,
      payload.allergen_info ?? null,
      payload.ingredients ?? null,
      payload.featured ?? false,
      payload.is_bestseller ?? false,
      payload.is_new_arrival ?? false,
      payload.display_order ?? 0,
      payload.is_active ?? true,
      payload.is_visible_in_menu ?? true,
      payload.is_available_for_delivery ?? true,
      payload.is_available_for_pickup ?? true,
      payload.image_url ?? null,
      payload.gallery_images ?? null,
      payload.thumbnail_url ?? null,
      payload.department ?? "kitchen",
      payload.is_inventory_tracked ?? null
    ];

    const result = await query(sql, values);
    return result.rows[0];
  }

  static async existsBySlug(slug: string): Promise<boolean> {
    const result = await query(
      "SELECT 1 FROM products WHERE slug = $1 LIMIT 1",
      [slug]
    );
    return (result.rowCount ?? 0) > 0;
  }

  static async update(
    id: string,
    data: UpdateProductDTO
  ): Promise<Product | null> {
    const keys = Object.keys(data);

    if (keys.length === 0) {
      return null;
    }

    // Build SET clause dynamically
    const setClauses: string[] = [];
    const values: any[] = [];

    keys.forEach((key, index) => {
      setClauses.push(`${key} = $${index + 1}`);
      values.push((data as any)[key]);
    });

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    const sql = `
      UPDATE products
      SET ${setClauses.join(", ")}
      WHERE id = $${values.length + 1}
      RETURNING *;
    `;

    values.push(id);

    const result = await query(sql, values);

    return result.rows[0] || null;
  }

  static async updateStatus(id: string, status: ProductStatus): Promise<Product | null> {
    const sql = `
      UPDATE products
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    const result = await query(sql, [status, id]);
    return result.rows[0] ?? null;
  }

  static async softDelete(id: string): Promise<Product | null> {
    const sql = `
      UPDATE products
      SET 
        is_active = FALSE,
        status = 'inactive',
        is_visible_in_menu = FALSE
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(sql, [id]);
    return result.rows[0] ?? null;
  }

  static async reactivate(id: string): Promise<Product | null> {
    const sql = `
      UPDATE products
      SET 
        is_active = TRUE,
        status = 'active',
        is_visible_in_menu = TRUE
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(sql, [id]);
    return result.rows[0] ?? null;
  }

  static async getByIds(
    ids: string[]
  ): Promise<{ id: string; category_id: string }[]> {
    const sql = `
    SELECT id, category_id
    FROM products
    WHERE id = ANY($1::uuid[])
  `;

    const result = await query(sql, [ids]);
    return result.rows;
  }

  static async bulkUpdateDisplayOrder(
    items: { id: string; display_order: number }[]
  ): Promise<void> {
    await transaction(async () => {
      for (const item of items) {
        const sql = `
        UPDATE products
        SET display_order = $1,
            updated_at = NOW()
        WHERE id = $2
      `;
        await query(sql, [item.display_order, item.id]);
      }
    });
  }

  // for order--new find by ids
  static async findByIds(ids: string[]): Promise<ProductSnapshot[]>;
  static async findByIds(client: any, ids: string[]): Promise<ProductSnapshot[]>;
  static async findByIds(clientOrIds: any, ids?: string[]): Promise<ProductSnapshot[]> {
    // Determine client and actual ids
    const client = ids === undefined
      ? { query: async (sql: string, params?: any[]) => pool.query(sql, params) }
      : clientOrIds;

    const productIds = ids === undefined ? clientOrIds : ids;

    if (productIds.length === 0) {
      return [];
    }

    const sql = `
      SELECT id, name, selling_price, is_active
      FROM products
      WHERE id = ANY($1)
    `;

    const result = await client.query(sql, [productIds]);
    return result.rows as ProductSnapshot[];
  }
}

export interface ProductSnapshot {
  id: string;
  name: string;
  selling_price: number;
  is_active: boolean;
}