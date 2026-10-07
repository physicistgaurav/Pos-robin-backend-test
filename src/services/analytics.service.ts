import { query } from "../config/database";
import {
  SalesAnalytics,
  TopMenuItem,
  DailySales,
  CategorySales,
} from "../types/analytics.types";

export class AnalyticsService {
  static async getSalesAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<SalesAnalytics> {
    const sql = `
      SELECT
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as total_orders,
        COALESCE(AVG(total_amount), 0) as average_order_value
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2
        AND status IN ('completed', 'served')
    `;

    const result = await query(sql, [startDate, endDate]);
    const data = result.rows[0];

    return {
      total_sales: parseFloat(data.total_sales),
      total_orders: parseInt(data.total_orders, 10),
      average_order_value: parseFloat(data.average_order_value),
      period_start: startDate,
      period_end: endDate,
    };
  }

  static async getTopMenuItems(limit: number = 10): Promise<TopMenuItem[]> {
    const sql = `
      SELECT
        mi.id as menu_item_id,
        mi.name as menu_item_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status IN ('completed', 'served')
      GROUP BY mi.id, mi.name
      ORDER BY total_revenue DESC
      LIMIT $1
    `;

    const result = await query(sql, [limit]);
    return result.rows.map((row) => ({
      menu_item_id: row.menu_item_id,
      menu_item_name: row.menu_item_name,
      total_quantity: parseInt(row.total_quantity, 10),
      total_revenue: parseFloat(row.total_revenue),
    }));
  }

  static async getDailySales(
    startDate: Date,
    endDate: Date
  ): Promise<DailySales[]> {
    const sql = `
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as order_count
      FROM orders
      WHERE created_at >= $1 AND created_at <= $2
        AND status IN ('completed', 'served')
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    const result = await query(sql, [startDate, endDate]);
    return result.rows.map((row) => ({
      date: row.date,
      total_sales: parseFloat(row.total_sales),
      order_count: parseInt(row.order_count, 10),
    }));
  }

  static async getCategorySales(): Promise<CategorySales[]> {
    const sql = `
      SELECT
        mi.category,
        COALESCE(SUM(oi.subtotal), 0) as total_sales,
        COUNT(DISTINCT oi.menu_item_id) as item_count
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status IN ('completed', 'served')
      GROUP BY mi.category
      ORDER BY total_sales DESC
    `;

    const result = await query(sql);
    return result.rows.map((row) => ({
      category: row.category,
      total_sales: parseFloat(row.total_sales),
      item_count: parseInt(row.item_count, 10),
    }));
  }
}
