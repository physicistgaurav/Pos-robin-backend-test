import { Response } from "express";
import { HTTP_STATUS } from "../config/constants";

interface ApiResponseData {
  success: boolean;
  message: string;
  data?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export class ApiResponse {
  static success(
    res: Response,
    data: any = null,
    message: string = "Success",
    statusCode: number = HTTP_STATUS.OK,
    meta?: any
  ): Response {
    const response: ApiResponseData = {
      success: true,
      message,
      data,
    };

    if (meta) {
      response.meta = meta;
    }

    return res.status(statusCode).json(response);
  }

  static created(
    res: Response,
    data: any = null,
    message: string = "Resource created successfully"
  ): Response {
    return this.success(res, data, message, HTTP_STATUS.CREATED);
  }

  static noContent(res: Response): Response {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }
}
