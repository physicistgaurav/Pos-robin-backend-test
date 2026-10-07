import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/asyncHandler';
import { InventoryController } from '../controllers/inventory.controller';
import {
  toggleInventoryTrackingSchema, getInventoryProductsSchema,
  getStockSchema, adjustStockSchema, purchaseStockSchema,
  wastageStockSchema, getMovementsSchema,
} from '../validators/inventory.validator';

const router = Router();

// Products
router.get('/products', validateRequest(getInventoryProductsSchema), asyncHandler(InventoryController.getInventoryProducts));
router.patch('/products/:id/toggle', validateRequest(toggleInventoryTrackingSchema), asyncHandler(InventoryController.toggleTracking));

// Stock
router.get('/stock', validateRequest(getStockSchema), asyncHandler(InventoryController.getStock));
router.get('/stock/low-stock', asyncHandler(InventoryController.getLowStock));
router.post('/stock/:productId/adjust', validateRequest(adjustStockSchema), asyncHandler(InventoryController.adjustStock));
router.post('/stock/:productId/purchase', validateRequest(purchaseStockSchema), asyncHandler(InventoryController.purchaseStock));
router.post('/stock/:productId/wastage', validateRequest(wastageStockSchema), asyncHandler(InventoryController.recordWastage));

// Movements
router.get('/movements/:productId', validateRequest(getMovementsSchema), asyncHandler(InventoryController.getMovements));

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