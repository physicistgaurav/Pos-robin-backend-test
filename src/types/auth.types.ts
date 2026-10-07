export type UserRole = "admin" | "manager" | "staff" | "waiter" | "chef";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  phone_number?: string;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_login: Date | null;
  created_at: Date;
}

export interface RegisterDTO {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
  phone_number?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface RequestUser {
  userId: string;
  email: string;
  role: UserRole;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone_number?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export interface changePassword {
  currentPassword: string;
  newPassword: string;
}
