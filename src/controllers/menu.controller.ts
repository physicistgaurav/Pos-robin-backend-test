import { Request, Response } from "express";
import { MenuService } from "../services/menu.service";
import { ApiResponse } from "../utils/ApiResponse";
import { SUCCESS_MESSAGES } from "../config/constants";

export class MenuController {
  static async create(req: Request, res: Response): Promise<Response> {
    const menuItem = await MenuService.createMenuItem(req.body);
    return ApiResponse.created(res, menuItem, SUCCESS_MESSAGES.CREATED);
  }

  static async getById(req: Request, res: Response): Promise<Response> {
    const id = parseInt(req.params.id, 10);
    const menuItem = await MenuService.getMenuItemById(id);
    return ApiResponse.success(res, menuItem, SUCCESS_MESSAGES.FETCHED);
  }

  static async getAll(req: Request, res: Response): Promise<Response> {
    const result = await MenuService.getAllMenuItems(req.query);
    return ApiResponse.success(
      res,
      result.items,
      SUCCESS_MESSAGES.FETCHED,
      200,
      result.meta
    );
  }

  static async update(req: Request, res: Response): Promise<Response> {
    const id = parseInt(req.params.id, 10);
    const menuItem = await MenuService.updateMenuItem(id, req.body);
    return ApiResponse.success(res, menuItem, SUCCESS_MESSAGES.UPDATED);
  }

  static async delete(req: Request, res: Response): Promise<Response> {
    const id = parseInt(req.params.id, 10);
    await MenuService.deleteMenuItem(id);
    return ApiResponse.success(res, null, SUCCESS_MESSAGES.DELETED);
  }
}
