import { Router } from "express";
import { TableController } from "../controllers/table.controller";
import { validateRequest } from "../middleware/validateRequest";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate, authorize } from "../middleware/auth.middleware";
import {
  createTableSchema,
  updateTableSchema,
} from "../validators/table.validator";
import { idParamSchema } from "../validators/menu.validator";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post(
  "/",
  authorize("admin", "manager"),
  validateRequest(createTableSchema),
  asyncHandler(TableController.create)
);

router.get("/", asyncHandler(TableController.getAll));

router.get("/available", asyncHandler(TableController.getAvailableTables));

router.get(
  "/:id",
  validateRequest(idParamSchema),
  asyncHandler(TableController.getById)
);

router.put(
  "/:id",
  authorize("admin", "manager", "waiter"),
  validateRequest(updateTableSchema),
  asyncHandler(TableController.update)
);

// toggle statud

router.patch("/:id/deactivate", authorize("admin", "manager"), validateRequest(idParamSchema), asyncHandler(TableController.deactivate))
router.patch("/:id/reactivate", authorize("admin", "manager"), validateRequest(idParamSchema), asyncHandler(TableController.reactivate))

// hard delete -- dont expose early
router.delete(
  "/:id",
  authorize("admin"),
  validateRequest(idParamSchema),
  asyncHandler(TableController.delete)
);

export default router;
