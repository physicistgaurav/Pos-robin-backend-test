import { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";

export class AnalyticsController {
  static async getSalesAnalytics(
    req: Request,
    res: Response
  ): Promise<Response> {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      throw ApiError.badRequest("start_date and end_date are required");
    }

    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw ApiError.badRequest("Invalid date format");
    }

    const analytics = await AnalyticsService.getSalesAnalytics(
      startDate,
      endDate
    );
    return ApiResponse.success(
      res,
      analytics,
      "Analytics fetched successfully"
    );
  }

  static async getTopMenuItems(req: Request, res: Response): Promise<Response> {
    const limit = parseInt((req.query.limit as string) || "10", 10);
    const topItems = await AnalyticsService.getTopMenuItems(limit);
    return ApiResponse.success(
      res,
      topItems,
      "Top menu items fetched successfully"
    );
  }

  static async getDailySales(req: Request, res: Response): Promise<Response> {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      throw ApiError.badRequest("start_date and end_date are required");
    }

    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw ApiError.badRequest("Invalid date format");
    }

    const dailySales = await AnalyticsService.getDailySales(startDate, endDate);
    return ApiResponse.success(
      res,
      dailySales,
      "Daily sales fetched successfully"
    );
  }

  static async getCategorySales(
    _req: Request,
    res: Response
  ): Promise<Response> {
    const categorySales = await AnalyticsService.getCategorySales();
    return ApiResponse.success(
      res,
      categorySales,
      "Category sales fetched successfully"
    );
  }
}
