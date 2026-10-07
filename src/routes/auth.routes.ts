import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { validateRequest } from "../middleware/validateRequest";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/rateLimiter";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateUserSchema,
  changePasswordSchema,
  changeUserRoleSchema,
  idParamSchema,
  resetUserPasswordSchema,
  createUserSchema,
} from "../validators/auth.validator";

const router = Router();

// Public routes
router.post(
  "/register",
  authLimiter,
  validateRequest(registerSchema),
  asyncHandler(AuthController.register)
);

router.post(
  "/login",
  authLimiter,
  validateRequest(loginSchema),
  asyncHandler(AuthController.login)
);

router.post(
  "/refresh",
  validateRequest(refreshTokenSchema),
  asyncHandler(AuthController.refreshToken)
);

// Protected routes
router.post("/logout", authenticate, asyncHandler(AuthController.logout));

router.get("/profile", authenticate, asyncHandler(AuthController.getProfile));

router.put(
  "/change-password",
  authenticate,
  validateRequest(changePasswordSchema),
  asyncHandler(AuthController.changePassword)
);

// Admin and Manageronly routes
router.post(
  "/users",
  authenticate,
  authorize("admin"),
  validateRequest(createUserSchema),
  asyncHandler(AuthController.createUser)
);

router.get(
  "/users",
  authenticate,
  authorize("admin", "manager"),
  asyncHandler(AuthController.getAllUsers)
);

router.put(
  "/users/:id",
  authenticate,
  authorize("admin", "manager"),
  validateRequest(updateUserSchema),
  asyncHandler(AuthController.updateUser)
);

router.put(
  "/users/:id/role",
  authenticate,
  authorize("admin", "manager"),
  validateRequest(changeUserRoleSchema),
  asyncHandler(AuthController.changeUserRole)
);


router.put(
  "/users/:id/reset-password",
  authenticate,
  authorize("admin", "manager"),
  validateRequest(resetUserPasswordSchema),
  asyncHandler(AuthController.resetUserPassword)
);

router.get(
  "/users/roles",
  authenticate,
  authorize("admin", "manager"),
  asyncHandler(AuthController.getUserRoles)
);

// hard delete, not recommended
router.delete(
  "/users/:id",
  authenticate,
  authorize("admin", "manager"),
  validateRequest(idParamSchema),
  asyncHandler(AuthController.deleteUser)
);

// deactive and reactivate
router.patch(
  "/users/:id/deactivate",
  authenticate,
  authorize("admin", "manager"),
  validateRequest(idParamSchema),
  asyncHandler(AuthController.deactivateUser)
);

router.patch(
  "/users/:id/reactivate",
  authenticate,
  authorize("admin", "manager"),
  validateRequest(idParamSchema),
  asyncHandler(AuthController.reactivateUser)
);

export default router;
