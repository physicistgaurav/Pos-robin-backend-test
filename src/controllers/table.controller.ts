import { Request, Response } from "express";
import { TableService } from "../services/table.service";
import { ApiResponse } from "../utils/ApiResponse";
import { TABLE_RESPONSE } from "../constants/table.response";

export class TableController {
  static async create(req: Request, res: Response): Promise<Response> {
    const table = await TableService.createTable(req.body);
    return ApiResponse.created(res, table, TABLE_RESPONSE.CREATED);
  }

  static async getById(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const table = await TableService.getTableById(id);
    return ApiResponse.success(res, table, TABLE_RESPONSE.GET_BY_ID);
  }

  static async getAll(req: Request, res: Response): Promise<Response> {
    const result = await TableService.getAllTables(req.query);

    return ApiResponse.success(
      res,
      result.tables,
      TABLE_RESPONSE.GET_ALL,
      200,
      // result.meta
    );
  }

  static async getAvailableTables(req: Request, res: Response): Promise<Response> {
    const result = await TableService.getAvailableTables(req.query);

    return ApiResponse.success(
      res,
      result.tables,
      TABLE_RESPONSE.GET_ALL,
      200,
      result.meta
    );
  }

  static async update(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const table = await TableService.updateTable(id, req.body);
    return ApiResponse.success(res, table, TABLE_RESPONSE.UPDATED);
  }


  static async deactivate(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    await TableService.deactivateTable(id);
    return ApiResponse.success(res, null, TABLE_RESPONSE.DEACTIVATED);
  }

  static async reactivate(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    await TableService.reactivateTable(id);
    return ApiResponse.success(res, null, TABLE_RESPONSE.REACTIVATED);
  }

  static async delete(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    await TableService.deleteTable(id);
    return ApiResponse.success(res, null, TABLE_RESPONSE.DELETED);
  }
}
