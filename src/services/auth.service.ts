import bcrypt from "bcryptjs";
import { UserModel } from "../models/user.model";
import {
  RegisterDTO,
  LoginDTO,
  AuthResponse,
  JWTPayload,
  changePassword,
  UserRole,
  CreateUserDTO,
} from "../types/auth.types";
import { ApiError } from "../utils/ApiError";
import { JWTUtils } from "../utils/jwt";
import config from "../config/environment";
import { AUTH_RESPONSE } from "../constants/auth.response";

// Login Flow
// User → email + password
//        ↓
// Fetch password_hash from DB
//        ↓
// bcrypt.compare(password, hash)
//        ↓
// IF MATCH:
//    Create JWT
//    Send JWT to client

// Data Transfer Object (DTO) => that defines the exact shape of data which is moved betn layers of application
export class AuthService {
  static async register(data: RegisterDTO): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(data.email);
    if (existingUser) {
      throw ApiError.conflict(AUTH_RESPONSE.ALREADY_EXISTS);
    }

    // Hash password
    const password_hash = await bcrypt.hash(
      data.password,
      config.security.bcryptRounds
    );

    // Create user
    const user = await UserModel.create({
      email: data.email,
      full_name: data.full_name,
      password: data.password,
      role: "staff", // ✅ FORCE ROLE
      password_hash,
    });

    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const { accessToken, refreshToken } = JWTUtils.generateTokenPair(payload);

    return {
      user: UserModel.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  static async login(data: LoginDTO): Promise<AuthResponse> {
    // Find user
    const user = await UserModel.findByEmail(data.email);
    if (!user) {
      throw ApiError.unauthorized(AUTH_RESPONSE.INVALID_EMAIL_PSWD);
    }

    // Check if user is active
    if (!user.is_active) {
      throw ApiError.forbidden(AUTH_RESPONSE.DEACTIVATED_USER);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      data.password,
      user.password_hash
    );
    if (!isPasswordValid) {
      throw ApiError.unauthorized(AUTH_RESPONSE.INVALID_EMAIL_PSWD);
    }

    // Update last login
    await UserModel.updateLastLogin(user.id);

    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const { accessToken, refreshToken } = JWTUtils.generateTokenPair(payload);

    return {
      user: UserModel.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  static async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Verify refresh token
    const payload = JWTUtils.verifyRefreshToken(refreshToken);

    // Verify user still exists and is active
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      throw ApiError.notFound(AUTH_RESPONSE.NO_USER);
    }

    if (!user.is_active) {
      throw ApiError.forbidden(AUTH_RESPONSE.DEACTIVATED_USER);
    }

    // Generate new tokens
    const newPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return JWTUtils.generateTokenPair(newPayload);
  }

  static async getProfile(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw ApiError.notFound(AUTH_RESPONSE.NO_USER);
    }
    return UserModel.sanitizeUser(user);
  }

  static async validateUser({ email, password }: LoginDTO) {
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const compare = await bcrypt.compare(password, user.password_hash);

    if (!compare) {
      throw ApiError.unauthorized("Invalid Password");
    }

    if (!user.is_active) {
      throw ApiError.unauthorized("User is inactive");
    }

    return user;
  }
  static async changePassword(userId: string, payload: changePassword) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw ApiError.notFound(AUTH_RESPONSE.NO_USER);
    }

    const match = await bcrypt.compare(
      payload.currentPassword,
      user.password_hash
    );
    if (!match) throw ApiError.unauthorized(AUTH_RESPONSE.INCORRECT_PASSWORD);

    const newHash = await bcrypt.hash(
      payload.newPassword,
      config.security.bcryptRounds
    );

    await UserModel.updatePassword(userId, newHash);

    return true;
  }

  static async createUser(data: CreateUserDTO) {
    const existingUser = await UserModel.findByEmail(data.email);
    if (existingUser) {
      throw ApiError.conflict(AUTH_RESPONSE.ALREADY_EXISTS);
    }
    
    // hash password
    const password_hash = await bcrypt.hash(
      data.password,
      config.security.bcryptRounds
    );

    // create user
    const user = await UserModel.create({
      email: data.email,
      full_name: data.full_name,
      password: data.password,
      role: data.role,
      phone_number: data.phone_number,
      password_hash,
    });
  
    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const { accessToken, refreshToken } = JWTUtils.generateTokenPair(payload);

    return {
      user: UserModel.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  static async resetUserPassword(userId: string, password: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw ApiError.notFound(AUTH_RESPONSE.NO_USER);
    }

    const newHash = await bcrypt.hash(password, config.security.bcryptRounds);
    await UserModel.updatePassword(userId, newHash);

    return true;
  }

  static async changeUserRole(userId: string, role: UserRole) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw ApiError.notFound(AUTH_RESPONSE.NO_USER);
    }

    await UserModel.updateUserRole(userId, role);

    return true;
  }
}
