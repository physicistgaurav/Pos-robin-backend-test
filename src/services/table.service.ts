import { todo } from "node:test";
import { TableModel } from "../models/table.model";
import { Table, CreateTableDTO, UpdateTableDTO } from "../types/table.types";
import { ApiError } from "../utils/ApiError";
import { calculatePagination, buildPaginationMeta } from "../utils/helpers";

export class TableService {
  static async createTable(data: CreateTableDTO): Promise<Table> {
    const existing = await TableModel.findByTableNumber(data.table_number);
    if (existing) {
      throw ApiError.conflict(
        `Table with number ${data.table_number} already exists`
      );
    }

    return await TableModel.create(data);
  }

  static async getTableById(id: string): Promise<Table> {
    const table = await TableModel.findById(id);
    if (!table) {
      throw ApiError.notFound(`Table with ID ${id} not found`);
    }
    return table;
  }

  static async getAllTables(query: { page?: number; limit?: number, is_active?: boolean }) {
    const {  is_active= true } = query;
    // const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { tables } = await TableModel.findAll({
      // limit: validatedLimit,
      // offset,
      is_active
    });

    return {
      tables,
      // meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  static async getAvailableTables(query: { page?: number; limit?: number, is_active?: boolean }) {
    const { page = 1, limit = 100, is_active= true } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { tables, total } = await TableModel.findAvailableTables({
      limit: validatedLimit,
      offset,
      is_active
    });

    return {
      tables,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  static async updateTable(id: string, data: UpdateTableDTO): Promise<Table> {
    const exists = await TableModel.findById(id);
    if (!exists) {
      throw ApiError.notFound(`Table with ID ${id} not found`);
    }

    if (data.table_number) {
      const duplicate = await TableModel.findByTableNumber(data.table_number);
      if (duplicate && duplicate.id !== id) {
        throw ApiError.conflict(
          `Table with number ${data.table_number} already exists`
        );
      }
    }

    const updated = await TableModel.update(id, data);
    if (!updated) {
      throw ApiError.internal("Failed to update table");
    }

    return updated;
  }

  static async deactivateTable(id: string): Promise<void> {
    const exists = await TableModel.findById(id);
    if (!exists) {
      throw ApiError.notFound(`Table with ID ${id} not found`);
    }

    //business-logic before deactivating table-- no pending orders in that table--also--deleetig
    todo

    const deactivatedTable = await TableModel.deactivate(id);
    if (!deactivatedTable) {
      throw ApiError.internal("Failed to deactivate table");
    }
  }

  static async reactivateTable(id: string): Promise<void> {
    const exists = await TableModel.findById(id);
    if (!exists) {
      throw ApiError.notFound(`Table with ID ${id} not found`);
    }

    //business-logic before deactivating table-- no pending orders in that table--also--deleetig
    todo

    const deactivatedTable = await TableModel.reactivate(id);
    if (!deactivatedTable) {
      throw ApiError.internal("Failed to deactivate table");
    }
  }

  static async deleteTable(id: string): Promise<void> {
    const exists = await TableModel.findById(id);
    if (!exists) {
      throw ApiError.notFound(`Table with ID ${id} not found`);
    }

    const deleted = await TableModel.delete(id);
    if (!deleted) {
      throw ApiError.internal("Failed to delete table");
    }
  }
}
