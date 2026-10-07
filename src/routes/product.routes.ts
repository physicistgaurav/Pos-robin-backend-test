
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/asyncHandler";
import { ProductController } from "../controllers/product.controller";
import { validateRequest } from "../middleware/validateRequest";
import {
  createProductSchema,
  reorderProductsSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from "../validators/product.validator";

const router = Router();

router.use(authenticate);

// get all products
router.get("/", asyncHandler(ProductController.getAll));

// pos menu
router.get("/pos-menu-legacy", asyncHandler(ProductController.getLegacyPOSMenu));
router.get("/hierarchy", asyncHandler(ProductController.getPOSMenu));



// get detail
router.get("/:id", asyncHandler(ProductController.getById));


// create a new product (simple, variant/combo)
router.post(
  "",
  authorize("admin", "manager"),
  validateRequest(createProductSchema),
  asyncHandler(ProductController.createProduct)
);

// update product
router.patch(
  "/:id",
  authorize("admin", "manager"),
  validateRequest(updateProductSchema),
  asyncHandler(ProductController.updateProduct)
);

// patch status
router.patch(
  "/:id/status",
  authorize("admin", "manager"),
  validateRequest(updateProductStatusSchema),
  asyncHandler(ProductController.updateProductStatus)
);

// toogle status ===> also check both status and is_active
router.patch(
  "/:id/deactivate",
  authorize("admin", "manager"),
  asyncHandler(ProductController.deactivateProduct)
);
router.patch(
  "/:id/reactivate",
  authorize("admin", "manager"),
  asyncHandler(ProductController.reactivateProduct)
);

router.post(
  "/reorder",
  authorize("admin", "manager"),
  validateRequest(reorderProductsSchema),
  asyncHandler(ProductController.reorderProducts)
);

export default router;


// Toggle Menu Visibility

// PATCH /api/products/{id}/visibility

// Purpose
// Show / hide from POS menu

// Payload

// {
//   "is_visible_in_menu": false
// }

// Response

// {
//   "visible": false
// }


//3 Search Products

// GET /api/products/search

// Purpose
// Fast POS search (FTS)

// Flow
// Full-text search → Limit results

// Query Params

// ?q=pizza

// Response

// [
//   { "id": "uuid", "name": "Pizza" }
// ]
