import { TABLE_STATUS } from "../config/constants";

export type TableStatus = (typeof TABLE_STATUS)[keyof typeof TABLE_STATUS];

export interface Table {
  id: string;
  table_number: string;
  table_name: string;
  capacity: number;
  status: TableStatus;
  location?: string;
  is_active?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTableDTO {
  table_number: string;
  table_name?: string;
  capacity: number;
  status?: TableStatus;
  location?: string;
  is_active?: boolean;
}

export interface UpdateTableDTO {
  table_number?: string;
  capacity?: number;
  status?: TableStatus;
  location?: string;
}
