import { Request, Response } from 'express';
import { StoreTransactionService } from '../services/store-transaction.service';
import { ApiResponse } from '../utils/ApiResponse';

export class StoreTransactionController {

  static async create(req: Request, res: Response): Promise<Response> {
    const result = await StoreTransactionService.create(req.body);
    return ApiResponse.success(res, result, 'Transaction created', 201);
  }

  static async void(req: Request, res: Response): Promise<Response> {
    const result = await StoreTransactionService.void(req.params.id,req.body);
    return ApiResponse.success(res, result, 'Transaction voided', 201);
  }
  

  static async findAll(req: Request, res: Response): Promise<Response> {
    const result = await StoreTransactionService.findAll(req.query);
    return ApiResponse.success(res, result, 'Transactions fetched', 200);
  }

  static async findById(req: Request, res: Response): Promise<Response> {
    const result = await StoreTransactionService.findById(req.params.id);
    return ApiResponse.success(res, result, 'Transaction fetched', 200);
  }

  static async update(req: Request, res: Response): Promise<Response> {
    const result = await StoreTransactionService.update(req.params.id, req.body);
    return ApiResponse.success(res, result, 'Transaction updated', 200);
  }

  static async delete(req: Request, res: Response): Promise<Response> {
    await StoreTransactionService.delete(req.params.id);
    return ApiResponse.success(res, null, 'Transaction deleted', 200);
  }

  static async getSummary(req: Request, res: Response): Promise<Response> {
    const result = await StoreTransactionService.getSummary(req.query);
    return ApiResponse.success(res, result, 'Summary fetched', 200);
  }

  static async getMonthlyPL(_req: Request, res: Response): Promise<Response> {
    const result = await StoreTransactionService.getMonthlyPL();
    return ApiResponse.success(res, result, 'Monthly P&L fetched', 200);
  }
}