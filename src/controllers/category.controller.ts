import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { CategoryFilters, CategoryFiltersMobile, DeactivateCategoryRequest, DeactivateOptions } from "../types/category.types";
import { ApiError } from "../utils/ApiError";
import { CATEGORY_RESPONSE } from "../constants/category.response";
import { CategoryService } from "../services/category.service";

export class CategoryController {
  static async getAll(req: Request, res: Response): Promise<Response> {
    
    const filters = req.query as unknown as CategoryFilters;
    
    const result = await CategoryService.getAllCategories(filters);
    return ApiResponse.success(res, result.categories, CATEGORY_RESPONSE.GET_ALL, 200, result.meta);
  }

  static async getAllMobile(req: Request, res: Response): Promise<Response> {
    
    const filters = req.query as unknown as CategoryFiltersMobile;
    
    const result = await CategoryService.getAllCategoriesMobile(filters);
    return ApiResponse.success(res, result.categories, CATEGORY_RESPONSE.GET_ALL_MOBILE, 200);
  }

  static async getById(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const category = await CategoryService.getCategoryById(id);
    return ApiResponse.success(res, category, CATEGORY_RESPONSE.GET_BY_ID);
  }

  static async getHierarchy(req: Request, res: Response): Promise<Response> {
    const hierarchy = await CategoryService.getHierarchy(req.query);
    return ApiResponse.success(res, hierarchy, CATEGORY_RESPONSE.MENU);
  }

  static async getSubcategories(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const subcategories = await CategoryService.getSubcategories(id);
    return ApiResponse.success(res, subcategories, CATEGORY_RESPONSE.SUB_CATEGORY);
  }

  static async createCategory (req: Request, res: Response) : Promise <Response> {
    const category = await CategoryService.createCategory(req.body)
    return ApiResponse.created(res, category, CATEGORY_RESPONSE.CREATED)
  }

  static async updateCategory(req: Request, res: Response) {
    const { id } = req.params;
    const category = await CategoryService.updateCategory(id, req.body);
    return ApiResponse.success(res, category, CATEGORY_RESPONSE.UPDATED);
  }

  static async reorderCategories(req: Request, res: Response) {
    const { parent_id, items } = req.body;
    await CategoryService.reorderCategories(parent_id, items);
    return ApiResponse.success(res, null, CATEGORY_RESPONSE.REORDER);
  }

  static async deactivateCategory(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const body = req.body as DeactivateCategoryRequest;

    // Parse options from request body
    let options: DeactivateOptions;
    
    if (body.productAction === 'reassign') {
      if (!body.targetCategoryId) {
        throw ApiError.badRequest(
          'targetCategoryId is required when productAction is "reassign"'
        );
      }
      options = { 
        action: 'reassign', 
        targetCategoryId: body.targetCategoryId 
      };
    } else if (body.productAction === 'deactivate') {
      options = { action: 'deactivate' };
    } else {
      options = { action: 'require-empty' };
    }

    const deactivatedCategory = await CategoryService.deactivateCategory(id, options);
    
    return ApiResponse.success(
      res, 
      deactivatedCategory, 
      CATEGORY_RESPONSE.DEACTIVATED
    );
  }

  static async reactivateCategory(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const reactivatedCategory = await CategoryService.reactivateCategory(id);
    
    return ApiResponse.success(
      res, 
      reactivatedCategory, 
      CATEGORY_RESPONSE.REACTIVATED
    );
  }
}