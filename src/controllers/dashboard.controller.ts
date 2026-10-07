// controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { ApiResponse } from '../utils/ApiResponse';
import { RangeMode, resolveDateRange } from '../utils/dateRange';

export class DashboardController {

  static async getOverview(_req: Request, res: Response): Promise<Response> {
    const result = await DashboardService.getOverview();
    return ApiResponse.success(res, result, 'Dashboard overview fetched', 200);
  }

  static async getSalesSummary(req: Request, res: Response): Promise<Response> {
    const {
      mode,
      from: customFrom,
      to:   customTo,
    } = req.query as {
      mode?:  RangeMode;
      from?:  string;
      to?:    string;
    };

    // Resolve the effective date window (smart partial-period logic lives here)
    const range = resolveDateRange(mode, customFrom, customTo);

    const result = await DashboardService.getSalesSummary(range.from, range.to);

    return ApiResponse.success(
      res,
      { ...result, range },   // surface resolved range so client knows what was queried
      'Sales summary fetched',
      200,
    );
  }

  static async getFoodDrinkSales(req: Request, res: Response): Promise<Response> {
    const {
      mode,
      from: customFrom,
      to:   customTo,
    } = req.query as {
      mode?:  RangeMode;
      from?:  string;
      to?:    string;
    };
  
    const range  = resolveDateRange(mode, customFrom, customTo);
    const result = await DashboardService.getFoodDrinkSales(range.from, range.to);
  
    return ApiResponse.success(
      res,
      { ...result, range },
      'Food & drink sales fetched',
      200,
    );
  }

  static async getSalesChart(req: Request, res: Response): Promise<Response> {
    const { period = 'daily', from, to } = req.query as any;
    const result = await DashboardService.getSalesChart(period, from, to);
    return ApiResponse.success(res, result, 'Sales chart fetched', 200);
  }

  static async getTopProducts(req: Request, res: Response): Promise<Response> {
    const { mode, from: customFrom, to: customTo, limit, category_id } = req.query as {
      mode?:        RangeMode;
      from?:        string;
      to?:          string;
      limit?:       string;
      category_id?: string;
    };
  
    const range  = resolveDateRange(mode, customFrom, customTo);
    const result = await DashboardService.getTopProducts({
      from:        range.from,
      to:          range.to,
      limit:       limit ? parseInt(limit) : 10,
      category_id: category_id ?? undefined,
    });
  
    return ApiResponse.success(res, { result, range }, 'Top products fetched', 200);
  }

  static async getTodaySoldProducts(
    _req: Request,
    res: Response
  ): Promise<Response> {
  
    const result = await DashboardService.getTodaySoldProducts();
  
    return ApiResponse.success(
      res,
      result,
      'Today sold products fetched',
      200
    );
  }

  static async getHourlyHeatmap(_req: Request, res: Response): Promise<Response> {
    const result = await DashboardService.getHourlyHeatmap();
    return ApiResponse.success(res, result, 'Hourly heatmap fetched', 200);
  }

  static async getCreditAging(_req: Request, res: Response): Promise<Response> {
    const result = await DashboardService.getCreditAging();
    return ApiResponse.success(res, result, 'Credit aging fetched', 200);
  }

  static async getStaffPerformance(req: Request, res: Response): Promise<Response> {
    const { from, to } = req.query as any;
    const result = await DashboardService.getStaffPerformance(from, to);
    return ApiResponse.success(res, result, 'Staff performance fetched', 200);
  }

  static async getRecentOrders(req: Request, res: Response): Promise<Response> {
    const { limit } = req.query as any;
    const parsed = parseInt(limit);
    const safeLimit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20;
    const result = await DashboardService.getRecentOrders(safeLimit);
    return ApiResponse.success(res, result, 'Recent orders fetched', 200);
  }

  static async getDiscountAnalysis(req: Request, res: Response): Promise<Response> {
    const { from, to } = req.query as any;
    const result = await DashboardService.getDiscountAnalysis(from, to);
    return ApiResponse.success(res, result, 'Discount analysis fetched', 200);
  }

  static async getCancellationAnalysis(req: Request, res: Response): Promise<Response> {
    const { from, to } = req.query as any;
    const result = await DashboardService.getCancellationAnalysis(from, to);
    return ApiResponse.success(res, result, 'Cancellation analysis fetched', 200);
  }
}