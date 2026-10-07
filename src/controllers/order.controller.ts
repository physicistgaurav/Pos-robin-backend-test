import { Request, Response } from "express";
import { OrderService } from "../services/order.service";
import { ApiResponse } from "../utils/ApiResponse";
import { ORDERS_RESPONSE } from "../constants/orders.response";

export class OrderController {

  static async create(req: Request, res: Response): Promise<Response> {
    const { order, items } = req.body;
    const userId = req.user?.userId ?? "";
    const createdOrder = await OrderService.createOrder(order, items, userId);
    return ApiResponse.created(res, createdOrder, ORDERS_RESPONSE.CREATED);
  }

  static async getById(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const order = await OrderService.getOrderById(id);
    return ApiResponse.success(res, order, ORDERS_RESPONSE.GET_BY_ID);
  }

  static async getAll(req: Request, res: Response): Promise<Response> {
    const result = await OrderService.getAllOrders(req.query);
    return ApiResponse.success(
      res,
      result.orders,
      ORDERS_RESPONSE.GET_ALL,
      200,
      result.meta
    );
  }

  static async getRecentOrders(_req: Request, res: Response): Promise<Response> {
    const orders = await OrderService.getRecentOrders();
  
    return res.status(200).json({
      success: true,
      message: "Recent orders retrieved successfully",
      data: orders,
    });
  }

  static async searchOrders(req: Request, res: Response): Promise<Response> {
    const query = req.query as any;
    const result = await OrderService.searchOrders(query);
  
    return ApiResponse.success(res, result.orders, "Orders found", 200, result.meta);
  }



  static async getActiveOrders(req: Request, res: Response): Promise<Response> {
    const result = await OrderService.getActiveOrders(req.query);
    return ApiResponse.success(
      res,
      result.orders,
      ORDERS_RESPONSE.GET_ACTIVE_ORDERS,
      200,
      result.meta
    );
  }

  static async getReceipt(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const receipt = await OrderService.generateReceipt(id);
    return ApiResponse.success(res, receipt, "Receipt fetched successfully");
  }

  static async getKitchenOrders(req: Request, res: Response): Promise<Response> {
    const result = await OrderService.getKitchenOrders(req.query);

    return ApiResponse.success(
      res,
      result.orders,
      "Kitchen orders fetched successfully",
      200,
      result.meta
    );
  }

  static async getBarOrder(req: Request, res: Response): Promise<Response> {
    const orders = await OrderService.getBarOrder(req.query);

    return ApiResponse.success(res, orders, "Bar orders fetched successfully");
  }

  static async update(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const order = await OrderService.updateOrder(id, req.body);
    return ApiResponse.success(res, order, ORDERS_RESPONSE.UPDATED);
  }

  static async applyDiscount(req: Request, res: Response): Promise<Response> {
    const { id: orderId } = req.params;
    const discountData = req.body;
  
    const updatedOrder = await OrderService.applyDiscount(orderId, discountData);
  
    return ApiResponse.success(res, updatedOrder, "Discount applied successfully");
  }

  static async cancel(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await OrderService.cancelOrder(id, reason);
    return ApiResponse.success(res, order, ORDERS_RESPONSE.CANCEL);
  }

  static async complete(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    const order = await OrderService.completeOrder(id);
    return ApiResponse.success(res, order, ORDERS_RESPONSE.COMPLETE);
  }

  static async serve(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;

    const order = await OrderService.serveOrder(id);
    return ApiResponse.success(res, order, ORDERS_RESPONSE.SERVE);
  }

  static async addItems(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { items } = req.body;
    // const userId = req.user?.userId ?? ""; // though not directly used here, kept for consistency
  
    const updatedOrder = await OrderService.addItemsToOrder(id, items);
  
    return ApiResponse.success(
      res,
      updatedOrder,
      "Items added to order successfully"
    );
  }

  static async updateItem(req: Request, res: Response): Promise<Response> {
    const { id: orderId, itemId } = req.params;
    const updateData = req.body;
  
    const updatedOrder = await OrderService.updateOrderItem(orderId, itemId, updateData);
  
    return ApiResponse.success(
      res,
      updatedOrder,
      "Order item updated successfully"
    );
  }

  static async removeItem(req: Request, res: Response): Promise<Response> {
    const {id: orderId, itemId} = req.params

    const removeOrderItem = await OrderService.removeOrderItem(orderId, itemId);

    return ApiResponse.success(res, removeOrderItem, "Item removed successfully")
  }

  static async updateItemStatus(req: Request, res: Response): Promise<Response> {
    const {id: orderId, itemId} = req.params
    const { item_status } = req.body;

    const updatedOrder = await OrderService.updateItemStatus(orderId, itemId, item_status);

    return ApiResponse.success(res, updatedOrder, "Item status updated successfully")
  }

}
