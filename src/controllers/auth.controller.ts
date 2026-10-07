import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { ApiResponse } from "../utils/ApiResponse";
import { UserModel } from "../models/user.model";
import { calculatePagination, buildPaginationMeta } from "../utils/helpers";
import { AUTH_RESPONSE } from "../constants/auth.response";
import { UserRole } from "../constants/auth.constants";
import { ApiError } from "../utils/ApiError";

// class groups together, Autocomplete is a bonus, not the reason
// Static methods are used to avoid instantiation
export class AuthController {
  static async register(req: Request, res: Response): Promise<Response> {
    const result = await AuthService.register(req.body);

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return ApiResponse.created(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
      },
      AUTH_RESPONSE.REGISTRATION
    );
  }

  static async login(req: Request, res: Response): Promise<Response> {
    const result = await AuthService.login(req.body);

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return ApiResponse.success(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
      },
      AUTH_RESPONSE.LOGIN
    );
  }

  static async refreshToken(req: Request, res: Response): Promise<Response> {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return ApiResponse.success(
        res,
        null,
        AUTH_RESPONSE.NO_REFRESH_TOKEN,
        401
      );
    }

    const tokens = await AuthService.refreshToken(refreshToken);

    // Set new refresh token in cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return ApiResponse.success(
      res,
      { accessToken: tokens.accessToken },
      AUTH_RESPONSE.REFRESH_TOKEN
    );
  }

  static async logout(_req: Request, res: Response): Promise<Response> {
    res.clearCookie("refreshToken");
    return ApiResponse.success(res, null, AUTH_RESPONSE.LOGOUT);
  }

  static async getProfile(req: Request, res: Response): Promise<Response> {
    const user = await AuthService.getProfile(req.user!.userId);
    return ApiResponse.success(res, user, AUTH_RESPONSE.GET_PROFILE);
  }

  static async getAllUsers(req: Request, res: Response): Promise<Response> {
    const { page = 1, limit = 10, role, is_active } = req.query;
    const { offset, limit: validatedLimit } = calculatePagination(
      Number(page),
      Number(limit)
    );

    const { users, total } = await UserModel.findAll({
      limit: validatedLimit,
      offset,
      role: role as string,
      is_active:
        is_active === "true" ? true : is_active === "false" ? false : undefined,
    });

    return ApiResponse.success(
      res,
      users,
      AUTH_RESPONSE.GET_USERS,
      200,
      buildPaginationMeta(total, Number(page), validatedLimit)
    );
  }
  static async createUser(req: Request, res: Response): Promise<Response> {
    const result = await AuthService.createUser(req.body);
    return ApiResponse.success(res, result, AUTH_RESPONSE.CREATE_USER);
  }

  static async updateUser(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const user = await UserModel.update(id, req.body);

    if (!user) {
      return ApiResponse.success(res, null, AUTH_RESPONSE.NO_USER, 404);
    }

    return ApiResponse.success(res, user, AUTH_RESPONSE.UPDATE_USER);
  }

  static async changePassword(req: Request, res: Response): Promise<Response> {
    const userId = req.user?.userId ?? "";

    const result = await AuthService.changePassword(userId, req.body);

    return ApiResponse.success(res, result, AUTH_RESPONSE.CHANGE_PASSWORD);
  }

  static async changeUserRole(req: Request, res: Response): Promise<Response> {
    const userId = req.params.id;
    const { role } = req.body;

    const result = await AuthService.changeUserRole(userId, role);

    return ApiResponse.success(res, result, AUTH_RESPONSE.CHANGE_ROLE);
  }


  static async resetUserPassword(req: Request, res: Response): Promise<Response> {
    const userId = req.params.id;
    const { password } = req.body;

    const result = await AuthService.resetUserPassword(userId, password);

    return ApiResponse.success(res, result, AUTH_RESPONSE.RESET_PASSWORD);
  }

  static async getUserRoles(_req: Request, res: Response): Promise<Response> {
    const result = UserRole;

    return ApiResponse.success(res, result, AUTH_RESPONSE.ROLES);
  }

  static async deleteUser(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;
    const deleted = await UserModel.delete(id);

    if (!deleted) {
      return ApiResponse.success(res, null, AUTH_RESPONSE.NO_USER, 404);
    }

    return ApiResponse.success(res, null, AUTH_RESPONSE.DELETE_USER);
  }

  static async deactivateUser(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;

    const user = await UserModel.findById(id);

    if (!user) throw ApiError.notFound(AUTH_RESPONSE.NO_USER);

    await UserModel.deactivate(user.id);

    return ApiResponse.success(res, null, AUTH_RESPONSE.DEACTIVATED);
  }

  static async reactivateUser(req: Request, res: Response): Promise<Response> {
    const id = req.params.id;

    const user = await UserModel.findById(id);

    if (!user) throw ApiError.notFound(AUTH_RESPONSE.NO_USER);

    await UserModel.reactivate(user.id);

    return ApiResponse.success(res, null, AUTH_RESPONSE.REACTIVATED);
  }
}
