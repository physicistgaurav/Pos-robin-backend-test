import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import { validateRequest } from "../middleware/validateRequest";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate, authorize } from "../middleware/auth.middleware";
import {
  addItemsToOrderSchema,
  applyDiscountSchema,
  cancelOrderSchema,
  createOrderSchema,
  deleteOrderItemSchema,
  getOrdersSchema,
  idParamSchema,
  queryBaseSchema,
  searchOrdersSchema,
  updateOrderItemSchema,
  updateOrderItemStatusSchema,
  updateOrderSchema,
} from "../validators/order.validator";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post(
  "/",
  authorize("admin", "manager", "waiter"),
  validateRequest(createOrderSchema),
  asyncHandler(OrderController.create)
);

router.get(
  "/recent",
  asyncHandler(OrderController.getRecentOrders)
);

router.get(
  "/",
  validateRequest(getOrdersSchema),
  asyncHandler(OrderController.getAll)
);

router.get(
  "/:id/receipt",
  authorize("admin", "manager"),
  validateRequest(idParamSchema),
  asyncHandler(OrderController.getReceipt)
);

router.get(
  "/search",
  validateRequest(searchOrdersSchema),
  asyncHandler(OrderController.searchOrders)
);

router.get(
  "/active",
  validateRequest(queryBaseSchema),
  asyncHandler(OrderController.getActiveOrders)
);


//  look kitchen view confirmed and preparing orders
router.get(
  "/kitchen",
  validateRequest(queryBaseSchema),
  authorize("admin", "manager", "chef", "waiter"), 
  asyncHandler(OrderController.getKitchenOrders)
);

// look bar view for bar items

router.get(
  "/bar",
  validateRequest(queryBaseSchema),
  authorize("admin","manager","staff", "waiter"),
  asyncHandler(OrderController.getBarOrder)
)

router.get(
  "/:id",
  validateRequest(idParamSchema),
  asyncHandler(OrderController.getById)
);


router.put(
  "/:id",
  authorize("admin", "manager", "waiter"),
  validateRequest(updateOrderSchema),
  asyncHandler(OrderController.update)
);

router.patch(
  "/:id/discount",
  authorize("admin", "manager"),
  validateRequest(applyDiscountSchema),
  asyncHandler(OrderController.applyDiscount)
);

router.patch(
  "/:id/cancel",
  authorize("admin", "manager"),
  validateRequest(cancelOrderSchema),
  asyncHandler(OrderController.cancel)
);

router.patch(
  "/:id/complete",
  authorize("admin", "manager", "waiter"),
  validateRequest(idParamSchema),
  asyncHandler(OrderController.complete)
);

router.patch(
  "/:id/serve",
  authorize("admin", "manager", "waiter"),
  validateRequest(idParamSchema),
  asyncHandler(OrderController.serve)
);


// order items to existing order
router.post(
  "/:id/items",
  authorize("admin", "manager", "waiter"),
  validateRequest(addItemsToOrderSchema),
  asyncHandler(OrderController.addItems)
);

// Update an order item (quantity, instructions, etc.)
router.put(
  "/:id/items/:itemId",
  authorize("admin", "manager", "waiter"),
  validateRequest(updateOrderItemSchema),
  asyncHandler(OrderController.updateItem)
);

// Remove an item from an order
router.delete(
  "/:id/items/:itemId",
  authorize("admin", "manager", "waiter"),
  validateRequest(deleteOrderItemSchema),
  asyncHandler(OrderController.removeItem)
);

// Update item status (e.g. preparing → ready)
router.patch(
  "/:id/items/:itemId/status",
  authorize("admin", "manager", "waiter", "chef"),
  validateRequest(updateOrderItemStatusSchema),
  asyncHandler(OrderController.updateItemStatus)
);

export default router;
