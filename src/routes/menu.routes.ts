import { Router } from "express";
import { MenuController } from "../controllers/menu.controller";
import { validateRequest } from "../middleware/validateRequest";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate, authorize } from "../middleware/auth.middleware";
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  getMenuItemsSchema,
  idParamSchema,
} from "../validators/menu.validator";

const router = Router();

// Public routes (can view menu)
router.get(
  "/",
  validateRequest(getMenuItemsSchema),
  asyncHandler(MenuController.getAll)
);

router.get(
  "/:id",
  validateRequest(idParamSchema),
  asyncHandler(MenuController.getById)
);

// Protected routes (staff and above can manage menu)
router.post(
  "/",
  authenticate,
  authorize("admin", "manager", "chef"),
  validateRequest(createMenuItemSchema),
  asyncHandler(MenuController.create)
);

router.put(
  "/:id",
  authenticate,
  authorize("admin", "manager", "chef"),
  validateRequest(updateMenuItemSchema),
  asyncHandler(MenuController.update)
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin", "manager"),
  validateRequest(idParamSchema),
  asyncHandler(MenuController.delete)
);

export default router;
