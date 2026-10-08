import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/asyncHandler';
import { InventoryController } from '../controllers/inventory.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  toggleInventoryTrackingSchema, getInventoryProductsSchema,
  getStockSchema, adjustStockSchema, purchaseStockSchema,
  wastageStockSchema, getMovementsSchema,
} from '../validators/inventory.validator';

const router = Router();

// All inventory endpoints require authentication — stock movements are money.
router.use(authenticate);

const STAFF_ROLES = ["admin", "manager", "staff"] as const;
const MANAGER_ROLES = ["admin", "manager"] as const;

// Products
router.get('/products', authorize(...STAFF_ROLES), validateRequest(getInventoryProductsSchema), asyncHandler(InventoryController.getInventoryProducts));
router.patch('/products/:id/toggle', authorize(...MANAGER_ROLES), validateRequest(toggleInventoryTrackingSchema), asyncHandler(InventoryController.toggleTracking));

// Stock
router.get('/stock', authorize(...STAFF_ROLES), validateRequest(getStockSchema), asyncHandler(InventoryController.getStock));
router.get('/stock/low-stock', authorize(...STAFF_ROLES), asyncHandler(InventoryController.getLowStock));
router.post('/stock/:productId/adjust', authorize(...MANAGER_ROLES), validateRequest(adjustStockSchema), asyncHandler(InventoryController.adjustStock));
router.post('/stock/:productId/purchase', authorize(...MANAGER_ROLES), validateRequest(purchaseStockSchema), asyncHandler(InventoryController.purchaseStock));
router.post('/stock/:productId/wastage', authorize(...MANAGER_ROLES), validateRequest(wastageStockSchema), asyncHandler(InventoryController.recordWastage));

// Movements
router.get('/movements/:productId', authorize(...STAFF_ROLES), validateRequest(getMovementsSchema), asyncHandler(InventoryController.getMovements));

export default router;



// One important integration point
// In your existing PaymentService.processPayment (or wherever you mark an order as completed), call InventoryService.deductForOrder for each order item that belongs to a tracked product:
// typescript// After order is marked completed
// for (const item of order.items) {
//   await InventoryService.deductForOrder(
//     item.id,
//     item.product_id,
//     item.quantity,
//     order.id,
//     userId
//   );
// }
// This keeps bar stock deductions tied to actual completed sales, not just order creation.