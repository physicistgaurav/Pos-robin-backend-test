import { OrderModel } from "../models/order.model";
import { TableModel } from "../models/table.model";
import {
  ALLOWABLE_STATUSES_FOR_ADDING_ITEMS,
  BLOCKED_PAYMENT_STATUSES_FOR_ADDING_ITEMS,
  CreateOrderDTO,
  CreateOrderItemDTO,
  DiscountType,
  Order,
  OrderItemStatus,
  OrderItemWithSnapshot,
  OrderStatus,
  STATUSES_TO_REVERT_ON_ADD_ITEMS,
  UpdateOrderDTO,
} from "../types/order.types";
import { ApiError } from "../utils/ApiError";

import { transaction } from "../config/database";
import { ProductModel } from "../models/Product.model";
import { OrderItemModel } from "../models/orderItem.model";
import { buildPaginationMeta, calculatePagination } from "../utils/helpers";
import { InventoryService } from "./inventory.service";

export class OrderService {
  static async createOrder(
    orderData: CreateOrderDTO,
    itemsData: CreateOrderItemDTO[],
    userId: string
  ) : Promise<Order>{
    return transaction(async (client) => {
      // 1. Validate table (if dine-in)
      if (orderData.order_type === "dine_in" && !orderData.table_id) {
        throw ApiError.badRequest("Table ID is required for dine-in orders");
      }

      if (orderData.table_id) {
        const table = await TableModel.findById(orderData.table_id);
        if (!table) {
          throw ApiError.notFound("Table not found");
        }
        if (!table.is_active) {
          throw ApiError.badRequest("Table is inactive and cannot be used for orders");
        }
      }

      // 2. Validate & fetch products
      const productIds = itemsData.map((i) => i.product_id);
      const products = await ProductModel.findByIds(productIds); // returns ProductSnapshot[]

      if (products.length !== productIds.length) {
        throw ApiError.badRequest("One or more products not found");
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      // 3. Prepare order items with price snapshot
      const orderItems: OrderItemWithSnapshot[] = itemsData.map((item) => {
        const product = productMap.get(item.product_id)!;

        if (!product.is_active) {
          throw ApiError.badRequest(
            `Product "${product.name}" is not available`
          );
        }

        const unitPrice = product.selling_price;

        return {
          ...item,
          product_name: product.name,
          product_price: unitPrice,
          unit_price: unitPrice,
          total_price: unitPrice * item.quantity,
        };
      });



      // 4. Create order
      const createdOrder = await OrderModel.create(client, orderData, userId);

      // 5. Insert items
      await OrderItemModel.bulkCreate(client, createdOrder.id, orderItems);

      return createdOrder;
    });
  }

  static async getOrderById(id: string) {
    const order = await OrderModel.findById(id);
    if (!order) {
      throw ApiError.notFound(`Order with ID ${id} not found`);
    }
    return order;
  }

  static async getAllOrders(query: {
    page?: number;
    limit?: number;
    status?: string;
    table_id?: string;
    order_type?: string;
    payment_status?: string;
    delivery_status?: string;
    start_date?: Date;
    end_date?: Date;
  }) {
    const { page = 1, limit = 100, ...filters } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { orders, total } = await OrderModel.findAll({
      ...filters,
      limit: validatedLimit,
      offset,
    });

    return {
      orders,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  static async getRecentOrders() {
    const { orders } = await OrderModel.getRecentOrders({
      limit: 50,
      offset: 0,
    });
  
    return orders.map(this.mapToRecentOrder);
  }

  static mapToRecentOrder(order: any) {
    return {
      id: order.id,
      orderCode: order.order_number,
  
      orderType: order.order_type,
  
      tableId: order.table_id,
      tableName: order.table_name,
  
      // 👤 Customer (for whom order is placed)
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
  
      // 🧑‍🍳 Staff (who created the order)
      orderedBy: order.staff_name,
  
      totalAmount: Number(order.total_amount),
      discount: Number(order.discount_amount),
      netAmount: Number(order.total_amount),
  
      orderDate: order.order_time,
  
      status: order.status?.toUpperCase(),
      paymentStatus: order.payment_status?.toUpperCase(),
  
      items: (order.order_items || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
  
        quantity: Number(item.quantity),
        price: Number(item.unit_price),
        subtotal: Number(item.total_price),
  
        status: item.item_status?.toUpperCase(),
      })),
    };
  }

  static async getActiveOrders(query: {
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 10, ...filters } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { orders, total } = await OrderModel.findActiveOrders({
      ...filters,
      limit: validatedLimit,
      offset,
    });

    return {
      orders,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  static async searchOrders(params:{
    q?: string;
  status?: string;
  payment_status?: string;
  order_type?: string;
  from_date?: string;
  to_date?: string;
  page: number;
  limit: number;
  }){

    const { page = 1, limit = 10, ...filters } = params;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { orders, total } = await OrderModel.searchOrders({
      ...filters,
      limit: validatedLimit,
      offset,
    });

    return {
      orders,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };

  }



  static async generateReceipt(orderId: string) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw ApiError.notFound("Order not found");

    // Format date/time
    const formattedDate = new Date(order.order_time).toLocaleDateString("en-NP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedTime = new Date(order.order_time).toLocaleTimeString("en-NP");
  
    return {
      order_number: order.order_number,
      order_date: formattedDate,
      order_time: formattedTime,
      order_type: order.order_type,
      table_id: order.table_id || "-",
      table_name: order.table_name || "-",
      customer_name: order.customer_name || "-",
      customer_phone: order.customer_phone || "-",
  
      items: order.order_items?.map((item: any) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.product_price,
        total_price: Number(item.product_price * item.quantity)
      })),
  
      subtotal: order.subtotal,
      discount_amount: order.discount_amount,
      // discount: order.discount_amount > 0 ? {
      //   type: order?.discount_type,
      //   value: order?.discount_value,
      //   amount: order.discount_amount,
      //   reason: order?.discount_reason,
      // } : null,
      // tax_amount: order.tax_amount,
      // service_charge: order.service_charge_amount,
      total_amount: order.total_amount,
  
      paid_amount: order.paid_amount,
      balance_amount: order.balance_amount,
      payment_status: order.payment_status,
  
      created_by: order.full_name || "-",
    };
  }

  static async getKitchenOrders(query: {
    page?: number;
    limit?: number;
  }) {

    const { page = 1, limit = 10, ...filters } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { orders, total } = await OrderModel.getKitchenOrders({
      ...filters,
      limit: validatedLimit,
      offset,
    });

    return {
      orders,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
 
  }

  static async getBarOrder(query: {
    page?: number;
    limit?: number;
  }) {

    const { page = 1, limit = 10, ...filters } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { orders, total } = await OrderModel.getBarOrder({
      ...filters,
      limit: validatedLimit,
      offset,
    });

    return {
      orders,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
 
  }

  static validateStatusTransition(
    from: string,
    to: string
  ) {
    const allowed: Record<string, string[]> = {
      pending: ['pending','confirmed', 'cancelled'],
      confirmed: ['confirmed','preparing', 'cancelled' ],
      preparing: ['preparing', 'ready', 'cancelled'],
      ready: [ 'ready', 'served',],
      served: ['served', 'cancelled'],
      completed: [],
      cancelled: []
    };
  
    if (!allowed[from]?.includes(to)) {
      throw ApiError.badRequest(
        `Invalid status transition from ${from} to ${to}`
      );
    }
  }

  static async updateOrder(
    id: string,
    data: UpdateOrderDTO
  ) {
    const exists = await OrderModel.findById(id);
    if (!exists) {
      throw ApiError.notFound("Order not found");
    }
  
    if (data.status) {
      this.validateStatusTransition(exists.status, data.status);
    }
  
    const updated = await OrderModel.update(id, data);
    if (!updated) {
      throw ApiError.internal("Failed to update order");
    }
  
    return updated;
  }

  static async applyDiscount(
    orderId: string,
    data: {
      discount_type: DiscountType;
      discount_value: number;
      discount_reason: string;
    }
  ) {
    return transaction(async (client) => {
      const order = await OrderModel.findById(client, orderId);
      if (!order) throw ApiError.notFound("Order not found");
  
      if (order.payment_status !== "unpaid") {
        throw ApiError.badRequest(
          "Discount can only be applied before any payment is made"
        );
      }
  
      // Validate discount value
      if (data.discount_type === "percentage" && (data.discount_value < 0 || data.discount_value > 100)) {
        throw ApiError.badRequest("Percentage discount must be between 0 and 100");
      }
  
      await OrderModel.updateDiscount(client, orderId, {
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        discount_reason: data.discount_reason,
      });
  
      // Trigger will recalculate discount_amount, tax, service, total_amount
      return await OrderModel.findById(client, orderId);
    });
  }

   static async cancelOrder(id: string, reason: string){

    const order = await OrderModel.findById(id);

    if (!order) {
      throw ApiError.notFound("Order not found");
    }
  
    if (order.status === "cancelled") {
      throw ApiError.badRequest("Order is already cancelled");
    }
  
    if (order.status === "completed") {
      throw ApiError.badRequest(
        "Completed orders cannot be cancelled"
      );
    }

    const cancelled = await OrderModel.cancel(id, reason);

    if (!cancelled) {
      throw ApiError.internal("Failed to cancel order");
    }

    return cancelled;
  }

  static async completeOrder(id: string) {
    // Early validation outside transaction — no lock needed yet
    const order = await OrderModel.findById(id);
    if (!order) throw ApiError.notFound("Order not found");
    if (order.status === "completed") throw ApiError.badRequest("Order is already completed");
    if (order.status === "cancelled") throw ApiError.badRequest("Cancelled orders cannot be completed");
  
    const inventoryErrors: string[] = [];
  
    return transaction(async (client) => {
      // Lock the row inside transaction
      const { rows } = await client.query(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const current = rows[0];
  
      if (!current) throw ApiError.notFound("Order not found");
      if (current.status === "completed") throw ApiError.badRequest("Order is already completed");
      if (current.status === "cancelled") throw ApiError.badRequest("Cancelled orders cannot be completed");
  
      // ✅ Pass client — stays in same transaction, no separate pool connection
      const items = await OrderItemModel.findByOrderId(id, client);
  
      for (const item of items) {
        try {
          // ✅ Pass client — inventory deduction in same transaction
          await InventoryService.deductForOrder(
            client,           // ← added
            item.id,
            item.product_id,
            item.quantity,
            id,
            current.created_by
          );
        } catch (err: any) {
          inventoryErrors.push(`${item.product_name}: ${err.message}`);
        }
      }
  
      await client.query(
        `UPDATE order_items SET item_status = 'completed', updated_at = NOW() WHERE order_id = $1`,
        [id]
      );
  
      const result = await client.query(
        `UPDATE orders SET status = 'completed' WHERE id = $1 RETURNING *`,
        [id]
      );
  
      return {
        ...result.rows[0],
        inventory_warnings: inventoryErrors.length > 0 ? inventoryErrors : undefined,
      };
    });
  }

  static async serveOrder(id: string){
    
    const order = await OrderModel.findById(id);

    if (!order) {
      throw ApiError.notFound("Order not found");
    }
  
    if (order.status === "cancelled") {
      throw ApiError.badRequest(
        "Cancelled orders cannot be served"
      );
    }

    const served = await OrderModel.serve(id);

    if (served === null) {
      throw ApiError.internal("Failed to serve order");
    }

    return served;
  }

  static async addItemsToOrder(orderId: string, itemsData: CreateOrderItemDTO[]) {
    return transaction(async (client) => {
      // 1. Fetch and validate order
      const order = await OrderModel.findById(client, orderId);
      if (!order) {
        throw ApiError.notFound("Order not found");
      }
  
      if (itemsData.length === 0) {
        return order;
      }
  
      // 2. Block paid orders entirely — check payment_status, not status
if (BLOCKED_PAYMENT_STATUSES_FOR_ADDING_ITEMS.includes(order.payment_status)) {
  throw ApiError.badRequest(
    `Cannot add items to a paid order. Please create a new order instead.`
  );
}
  
      // 3. Validate products
      const productIds = itemsData.map((i) => i.product_id);
      const uniqueProductIds = [...new Set(productIds)];
  
      const products = await ProductModel.findByIds(client, uniqueProductIds);
  
      if (products.length !== uniqueProductIds.length) {
        throw ApiError.badRequest("One or more products not found");
      }
  
      const productMap = new Map(products.map((p) => [p.id, p]));
  
      // 4. Prepare order items with price snapshot
      const orderItems: OrderItemWithSnapshot[] = itemsData.map((item) => {
        const product = productMap.get(item.product_id)!;
  
        if (!product.is_active) {
          throw ApiError.badRequest(`Product "${product.name}" is not available`);
        }
  
        const unitPrice = product.selling_price;
  
        return {
          ...item,
          product_name: product.name,
          product_price: unitPrice,
          unit_price: unitPrice,
          total_price: unitPrice * item.quantity,
          item_status: 'pending' as const,
        };
      });
  
      // 5. Bulk insert items
      await OrderItemModel.bulkCreate(client, orderId, orderItems);
  
      // 6. Revert order status if needed (e.g. completed → pending)
      const revertedStatus = STATUSES_TO_REVERT_ON_ADD_ITEMS[order.status];
      if (revertedStatus) {
        await OrderModel.updateStatus(client, orderId, revertedStatus);
      }
  
      // 7. Fetch updated order (totals recalculated by trigger)
      const updatedOrder = await OrderModel.findById(client, orderId);
      return updatedOrder;
    });
  }

  static async updateOrderItem(
    orderId: string,
    itemId: string,
    updateData: {
      quantity?: number;
      special_instructions?: string;
      variant_name?: string | null;
      customizations?: string | null;
      item_status?: string | null;
    }
  ) {
    return transaction(async (client) => {
      // 1. Fetch order and validate status
      const order = await OrderModel.findById(client, orderId);
      if (!order) {
        throw ApiError.notFound("Order not found");
      }
  
      if (!ALLOWABLE_STATUSES_FOR_ADDING_ITEMS.includes(order.status)) {
        throw ApiError.badRequest(
          `Cannot update items on order with status: ${order.status}`
        );
      }
  
      // 2. Fetch the order item
      const item = await OrderItemModel.findById(client, itemId);
      if (!item) {
        throw ApiError.notFound("Order item not found");
      }
  
      if (item.order_id !== orderId) {
        throw ApiError.badRequest("Order item does not belong to this order");
      }
  
      // 3. If quantity is changing, re-validate product and recalculate total_price
      let totalPrice = item.total_price;
      if (updateData.quantity !== undefined) {
        if (updateData.quantity < 1) {
          throw ApiError.badRequest("Quantity must be at least 1");
        }
  
        // Re-fetch product to confirm it's still active and get current selling price
        const product = await ProductModel.findById(client, item.product_id);
        if (!product) {
          throw ApiError.notFound("Product no longer exists");
        }
        if (!product.is_active) {
          throw ApiError.badRequest(`Product "${product.name}" is no longer available`);
        }
  
        // Keep historical unit_price, but update total_price based on new quantity
        totalPrice = product.selling_price * updateData.quantity;
      }
  
      // 4. Update the order item
      await OrderItemModel.update(client, itemId, {
        quantity: updateData.quantity,
        special_instructions: updateData.special_instructions,
        variant_name: updateData.variant_name,
        customizations: updateData.customizations,
        item_status: updateData.item_status,
        total_price: updateData.quantity !== undefined ? totalPrice : undefined,
      });
  
      // 5. Return fresh order (trigger will have recalculated totals)
      return await OrderModel.findById(client, orderId);
    });
  }

  static async removeOrderItem(orderId: string, itemId: string) {
    return transaction(async (client) => {
      // 1 validate order and status
      const order = await OrderModel.findById(client, orderId);
      if (!order) throw ApiError.notFound("Order not found")
      
      // if(!ALLOWABLE_STATUSES_FOR_ADDING_ITEMS.includes(order.status)){
      //   throw ApiError.badRequest(`Cannot remove items from order with status ${order.status}`)
      // }  

      // 2 check if item exists and belongs o order
      const item = await OrderItemModel.findById(client, itemId)
      if(!item) throw ApiError.notFound("Order item not found")
      if(item.order_id !== orderId){
        throw ApiError.badRequest("Item does not belong to this order")
      } 
      
      //3 Delete the item
      await OrderItemModel.delete(client, itemId)

      // 4. return updated order
      return await OrderModel.findById(client,orderId)
    })
  }

  static async updateItemStatus(
    orderId: string,
    itemId: string,
    item_status: OrderItemStatus
  ) {
    return transaction(async (client) => {
      const order = await OrderModel.findById(client, orderId);
      if (!order) throw ApiError.notFound("Order not found");
  
      const allowedOrderStatuses: OrderStatus[] = [
        'pending', 'confirmed', 'preparing', 'ready', 'served'
      ];
      if (!allowedOrderStatuses.includes(order.status)) {
        throw ApiError.badRequest(`Cannot update item status on order with status: ${order.status}`);
      }
  
      const item = await OrderItemModel.findById(client, itemId);
      if (!item) throw ApiError.notFound("Order item not found");
      if (item.order_id !== orderId) {
        throw ApiError.badRequest("Item does not belong to this order");
      }
  
      await OrderItemModel.update(client, itemId, { item_status });


      // must do complete order because due to inventory.
  
      // // ✅ Fix 1: pass client as second argument (matching the signature)
      // const allItems = await OrderItemModel.findByOrderId(orderId, client);
      // const allCompleted = allItems.every((i) =>
      //   i.id === itemId ? item_status === 'completed' : i.item_status === 'completed'
      // );
  
      // if (allCompleted) {
      //   // ✅ Fix 2: pass client so this runs inside the transaction
      //   await OrderModel.update(orderId, { status: 'completed' }, client);
      // }
  
      return await OrderModel.findById(client, orderId);
    });
  }

  // private static validateStatusTransition(
  //   currentStatus: string,
  //   newStatus: string
  // ): void {
  //   const validTransitions: { [key: string]: string[] } = {
  //     [ORDER_STATUS.PENDING]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  //     [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  //     [ORDER_STATUS.READY]: [ORDER_STATUS.SERVED],
  //     [ORDER_STATUS.SERVED]: [ORDER_STATUS.COMPLETED],
  //     [ORDER_STATUS.COMPLETED]: [],
  //     [ORDER_STATUS.CANCELLED]: [],
  //   };

  //   if (!validTransitions[currentStatus]?.includes(newStatus)) {
  //     throw ApiError.badRequest(
  //       `Invalid status transition from ${currentStatus} to ${newStatus}`
  //     );
  //   }
  // }

  // private static validateStatusTransition(
  //   currentStatus: string,
  //   newStatus: string
  // ): void {
  //   const validTransitions: { [key: string]: string[] } = {
  //     [ORDER_STATUS.PENDING]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  //     [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  //     [ORDER_STATUS.READY]: [ORDER_STATUS.SERVED],
  //     [ORDER_STATUS.SERVED]: [ORDER_STATUS.COMPLETED],
  //     [ORDER_STATUS.COMPLETED]: [],
  //     [ORDER_STATUS.CANCELLED]: [],
  //   };

  //   if (!validTransitions[currentStatus]?.includes(newStatus)) {
  //     throw ApiError.badRequest(
  //       `Invalid status transition from ${currentStatus} to ${newStatus}`
  //     );
  //   }
  // }
}
