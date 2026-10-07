// services/inventory.service.ts
import { PoolClient } from 'pg';
import { query } from '../config/database';
import { InventoryModel } from '../models/inventory.model';
import { ApiError } from '../utils/ApiError';

export class InventoryService {

  static async toggleTracking(productId: string, data: any) {
    // Check product exists
    const { rows } = await query('SELECT id, name FROM products WHERE id = $1', [productId]);
    if (!rows[0]) throw ApiError.notFound('Product not found');

    return InventoryModel.toggleTracking(productId, data);
  }

  static async getTrackedProducts(filters: any) {
    return InventoryModel.getTrackedProducts(filters);
  }

  static async getStock(filters: any) {
    if (filters.product_id) {
      const stock = await InventoryModel.getStockByProductId(filters.product_id);
      if (!stock) throw ApiError.notFound('Product not found in inventory');
      return stock;
    }
    return InventoryModel.getTrackedProducts(filters);
  }

  static async adjustStock(productId: string, data: any) {
    const stock = await InventoryModel.getStockByProductId(productId);
    if (!stock) throw ApiError.notFound('Product not found in inventory');
  
    // ❌ Block old return
    if (data.movement_type === 'return') {
      throw ApiError.badRequest('Use customer_return or supplier_return');
    }
  
    // ✅ Rules enforcement
    if (data.movement_type !== 'adjustment' && data.quantity <= 0) {
      throw ApiError.badRequest('Quantity must be positive for this movement type');
    }
  
    if (data.movement_type === 'supplier_return' && data.quantity <= 0) {
      throw ApiError.badRequest('Supplier return must be positive quantity');
    }
  
    if (data.movement_type === 'customer_return' && data.quantity <= 0) {
      throw ApiError.badRequest('Customer return must be positive quantity');
    }
  
    if (data.movement_type === 'purchase' && !data.unit_cost) {
      throw ApiError.badRequest('unit_cost is required for purchase');
    }
  
    const movement = await InventoryModel.createMovement({
      product_id: productId,
      movement_type: data.movement_type,
      quantity: data.quantity,
      unit_cost: data.unit_cost ?? null,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      created_by: data.processed_by,
    });
  
    const updated = await InventoryModel.getStockByProductId(productId);
  
    return { movement, stock: updated };
  }

  static async purchaseStock(productId: string, data: any) {
    const stock = await InventoryModel.getStockByProductId(productId);
    if (!stock) throw ApiError.notFound('Product not found in inventory');

    const movement = await InventoryModel.createMovement({
      product_id: productId,
      movement_type: 'purchase',
      quantity: data.quantity,
      unit_cost: data.unit_cost,
      total_cost: data.quantity * data.unit_cost,
      store_txn_id: data.store_txn_id ?? null,
      supplier_name: data.supplier_name ?? null,
      supplier_invoice: data.supplier_invoice ?? null,
      notes: data.notes ?? null,
      created_by: data.processed_by,
    });

    const updated = await InventoryModel.getStockByProductId(productId);
    return { movement, stock: updated };
  }

  static async recordWastage(productId: string, data: any) {
    const stock = await InventoryModel.getStockByProductId(productId);
    if (!stock) throw ApiError.notFound('Product not found in inventory');

    if (data.quantity > stock.current_stock) {
      throw ApiError.badRequest(
        `Wastage quantity (${data.quantity}) exceeds current stock (${stock.current_stock})`
      );
    }

    const movement = await InventoryModel.createMovement({
      product_id: productId,
      movement_type: 'wastage',
      quantity: data.quantity,
      reason: data.reason,
      notes: data.notes ?? null,
      created_by: data.processed_by,
    });

    const updated = await InventoryModel.getStockByProductId(productId);
    return { movement, stock: updated };
  }

  static async getMovements(productId: string, filters: any) {
    const stock = await InventoryModel.getStockByProductId(productId);
    if (!stock) throw ApiError.notFound('Product not found in inventory');
    return InventoryModel.getMovements(productId, filters);
  }

  static async getLowStock() {
    return InventoryModel.getLowStock();
  }

  // Called internally from order completion
  static async deductForOrder(
    client: PoolClient,
    orderItemId: string,
    productId: string,
    quantity: number,
    orderId: string,
    userId: string
  ) {
    const stock = await InventoryModel.getStockByProductId(client, productId);
    if (!stock) return; // not tracked, skip
  
    if (quantity > stock.current_stock) {
      throw new Error(
        `Insufficient stock. Available: ${stock.current_stock}, Required: ${quantity}`
      );
    }
  
    // Just insert a movement — trigger handles the rest
    await client.query(
      `INSERT INTO stock_movements 
        (product_id, movement_type, quantity, order_id, order_item_id, created_by)
       VALUES ($1, 'sale', $2, $3, $4, $5)`,
      [productId, quantity, orderId, orderItemId, userId]
    );
  }
}