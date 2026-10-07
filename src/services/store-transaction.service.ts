import { StoreTransactionModel } from '../models/store-transaction.model';
import { InventoryModel } from '../models/inventory.model';
import { ApiError } from '../utils/ApiError';
import { query } from '../config/database';

export class StoreTransactionService {

  static async create(data: any) {
    const { inventory_purchase, ...txnData } = data;

    // 1. Create the store transaction
    const transaction = await StoreTransactionModel.create(txnData);

    // 2. If inventory purchase, also create a stock movement
    let stockMovement = null;
    if (data.category === 'inventory_purchase' && inventory_purchase) {
      const stock = await InventoryModel.getStockByProductId(inventory_purchase.product_id);
      if (!stock) {
        throw ApiError.badRequest('Product is not inventory-tracked. Enable tracking first.');
      }

      stockMovement = await InventoryModel.createMovement({
        product_id: inventory_purchase.product_id,
        movement_type: 'purchase',
        quantity: inventory_purchase.quantity,
        unit_cost: inventory_purchase.unit_cost,
        total_cost: inventory_purchase.quantity * inventory_purchase.unit_cost,
        store_txn_id: transaction.id,
        supplier_name: inventory_purchase.supplier_name ?? data.party_name ?? null,
        supplier_invoice: inventory_purchase.supplier_invoice ?? data.reference_number ?? null,
        notes: data.notes ?? null,
        created_by: data.created_by,
      });
    }

    return { transaction, stock_movement: stockMovement };
  }

  static async void(id: string, data: { void_reason: string; voided_by: string }) {
    try {
      const result = await query(
        `SELECT void_store_transaction($1, $2, $3) as result`,
        [id, data.voided_by, data.void_reason]
      );
  
      return result.rows[0].result;
  
    } catch (error: any) {
      console.error(error); // keep this
    
      switch (error.code) {
        case 'P0001':
          throw ApiError.notFound('Transaction not found');
        case 'P0002':
          throw ApiError.badRequest('Transaction is already voided');
        case 'P0003':
          throw ApiError.badRequest('Void reason is required');
        default:
          throw ApiError.internal('Failed to void transaction');
      }
    }
  }

  static async findAll(filters: any) {
    return StoreTransactionModel.findAll(filters);
  }

  static async findById(id: string) {
    const txn = await StoreTransactionModel.findById(id);
    if (!txn) throw ApiError.notFound('Transaction not found');
    return txn;
  }

  static async update(id: string, data: any) {
    const txn = await StoreTransactionModel.findById(id);
    if (!txn) throw ApiError.notFound('Transaction not found');
    return StoreTransactionModel.update(id, data);
  }

  static async delete(id: string) {
    const txn = await StoreTransactionModel.findById(id);
    if (!txn) throw ApiError.notFound('Transaction not found');

    // Don't allow deletion if it's linked to a stock movement
    const { rows } = await query(
      `SELECT id FROM stock_movements WHERE store_txn_id = $1 LIMIT 1`, [id]
    );
    if (rows[0]) {
      throw ApiError.badRequest(
        'Cannot delete a transaction linked to a stock movement. Adjust the stock instead.'
      );
    }

    return StoreTransactionModel.delete(id);
  }

  static async getSummary(filters: any) {
    return StoreTransactionModel.getSummary(filters);
  }

  static async getMonthlyPL() {
    return StoreTransactionModel.getMonthlyPL();
  }
}