// routes/dashboard.routes.ts
import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/asyncHandler';
import { DashboardController } from '../controllers/dashboard.controller';
import {
  salesSummarySchema, salesChartSchema, topProductsSchema, staffPerformanceSchema,
  foodDrinkSalesSchema,
} from '../validators/dashboard.validator';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Main dashboard load — one call, all cards
router.get('/overview',    authenticate,
  authorize("admin", "manager"),           asyncHandler(DashboardController.getOverview));

// Sales report — user picks date range
router.get('/sales-summary',   authenticate,
  authorize("admin", "manager"),       validateRequest(salesSummarySchema),   asyncHandler(DashboardController.getSalesSummary));

// Food vs drink — daily/weekly/monthly/yearly
router.get(
  '/food-drink-sales',
  authenticate,
  authorize("admin", "manager"),
  validateRequest(foodDrinkSalesSchema),
  asyncHandler(DashboardController.getFoodDrinkSales),
);

// Drill-downs
router.get('/top-products', authenticate,
  authorize("admin", "manager"),          validateRequest(topProductsSchema),     asyncHandler(DashboardController.getTopProducts));

router.get(
  '/today-sold-products',
  authenticate,
  authorize("admin", "manager"),
  asyncHandler(DashboardController.getTodaySoldProducts)
);

router.get('/recent-orders',          asyncHandler(DashboardController.getRecentOrders));

router.get('/credit-aging',           asyncHandler(DashboardController.getCreditAging));

router.get('/sales-chart',            validateRequest(salesChartSchema),      asyncHandler(DashboardController.getSalesChart));
router.get('/hourly-heatmap',         asyncHandler(DashboardController.getHourlyHeatmap));
router.get('/staff-performance',      validateRequest(staffPerformanceSchema), asyncHandler(DashboardController.getStaffPerformance));

router.get('/discount-analysis',      asyncHandler(DashboardController.getDiscountAnalysis));
router.get('/cancellation-analysis',  asyncHandler(DashboardController.getCancellationAnalysis));

export default router;