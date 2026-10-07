import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication and manager/admin role
router.use(authenticate);
router.use(authorize("admin", "manager"));

router.get("/sales", asyncHandler(AnalyticsController.getSalesAnalytics));
router.get("/top-items", asyncHandler(AnalyticsController.getTopMenuItems));
router.get("/daily-sales", asyncHandler(AnalyticsController.getDailySales));
router.get(
  "/category-sales",
  asyncHandler(AnalyticsController.getCategorySales)
);

export default router;
