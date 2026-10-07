import { Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { ApiResponse } from '../utils/ApiResponse';

export class InventoryController {

  static async toggleTracking(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await InventoryService.toggleTracking(id, req.body);
    return ApiResponse.success(res, result, 'Inventory tracking updated', 200);
  }

  static async getInventoryProducts(req: Request, res: Response): Promise<Response> {
    const result = await InventoryService.getTrackedProducts(req.query);
    return ApiResponse.success(res, result, 'Inventory products fetched', 200);
  }

  static async getStock(req: Request, res: Response): Promise<Response> {
    const result = await InventoryService.getStock(req.query);
    return ApiResponse.success(res, result, 'Stock fetched', 200);
  }

  static async adjustStock(req: Request, res: Response): Promise<Response> {
    const result = await InventoryService.adjustStock(req.params.productId, req.body);
    return ApiResponse.success(res, result, 'Stock adjusted', 201);
  }

  static async purchaseStock(req: Request, res: Response): Promise<Response> {
    const result = await InventoryService.purchaseStock(req.params.productId, req.body);
    return ApiResponse.success(res, result, 'Stock purchase recorded', 201);
  }

  static async recordWastage(req: Request, res: Response): Promise<Response> {
    const result = await InventoryService.recordWastage(req.params.productId, req.body);
    return ApiResponse.success(res, result, 'Wastage recorded', 201);
  }

  static async getMovements(req: Request, res: Response): Promise<Response> {
    const result = await InventoryService.getMovements(req.params.productId, req.query);
    return ApiResponse.success(res, result, 'Stock movements fetched', 200);
  }

  static async getLowStock(_req: Request, res: Response): Promise<Response> {
    const result = await InventoryService.getLowStock();
    return ApiResponse.success(res, result, 'Low stock products fetched', 200);
  }
}