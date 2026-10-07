import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { ProductServices } from "../services/product.service";
import { ProductFilters, UpdateProductDTO } from "../types/product.types";
import { PRODUCT_RESPONSE } from "../constants/products.response";

export class ProductController {
  static async getAll(req: Request, res: Response): Promise<Response> {
    const filters = req.query as unknown as ProductFilters;
    const result = await ProductServices.getAll(filters);
    return ApiResponse.success(
      res,
      result,
      PRODUCT_RESPONSE.GET_ALL,
      200,
      result.meta
    );
  }

  static async getById(req: Request, res: Response) {
    const id = req.params.id;

    const product = await ProductServices.getById(id);
    return ApiResponse.success(res, product, PRODUCT_RESPONSE.GET_BY_ID);
  }

  static async getPOSMenu(req: Request, res: Response): Promise<Response> {
    const hierarchy = await ProductServices.getPosMenu(req.query);
    return ApiResponse.success(res, hierarchy, PRODUCT_RESPONSE.MENU);
  }

  static async getLegacyPOSMenu(req: Request, res: Response): Promise<Response> {
    const { categories, search } = req.query;
  
    const data = await ProductServices.getLegacyPOSMenu({
      categories: categories as string,
      search: search as string,
    });
  
    return ApiResponse.success(res, data, "Legacy POS menu fetched");
  }

  static async createProduct(req: Request, res: Response): Promise<Response> {
    const product = await ProductServices.createProduct(req.body);
    return ApiResponse.created(res, product, PRODUCT_RESPONSE.CREATED);
  }

  static async updateProduct(req: Request, res: Response) {
    const id = req.params.id;
    const data = req.body as UpdateProductDTO;
    const product = await ProductServices.update(id, data);
    return ApiResponse.success(res, product, PRODUCT_RESPONSE.UPDATED, 200);
  }

  static async updateProductStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = req.body;
    const product = await ProductServices.updateStatus(id, status);
    return ApiResponse.success(res, product, PRODUCT_RESPONSE.STATUS_UPDATED, 200);
  }

  static async deactivateProduct(req: Request, res: Response) {
    const { id } = req.params;

    const product = await ProductServices.deactivate(id);

    return ApiResponse.success(
      res,
      product,
      "Product deactivated successfully",
      200
    );
  }

  static async reactivateProduct(req: Request, res: Response) {
    const { id } = req.params;

    const product = await ProductServices.reactivate(id);

    return ApiResponse.success(
      res,
      product,
      "Product reactivated successfully",
      200
    );
  }

  static async reorderProducts(req: Request, res: Response) {
    const { category_id, items } = req.body;
    await ProductServices.reorderProducts(category_id, items);
    return ApiResponse.success(res, null, PRODUCT_RESPONSE.REORDER);
  }
}
