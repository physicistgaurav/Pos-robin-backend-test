import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/asyncHandler";
import { CategoryController } from "../controllers/category.controller";
import { createCategorySchema, reorderCategoriesSchema, updateCategorySchema } from "../validators/category.validator";
import { validateRequest } from "../middleware/validateRequest";
import { todo } from "node:test";

const router = Router();

// All routes require authentication
router.use(authenticate);

// flatted categorues for admin panel--- view all, edit/delete, search, enable/disable , reorder, 
router.get("/", asyncHandler(CategoryController.getAll));

router.get("/mobile", asyncHandler(CategoryController.getAllMobile));

// create main or sub-category
router.post(
    "/",
    authorize("admin", "manager"),
    validateRequest(createCategorySchema),
    asyncHandler(CategoryController.createCategory)
  );

  // update category
  router.patch(
    "/:id",
    authorize("admin", "manager"),
    validateRequest(updateCategorySchema),
    asyncHandler(CategoryController.updateCategory)
  );

  router.post(
    "/reorder",
    authorize("admin", "manager"),
    validateRequest(reorderCategoriesSchema),
    asyncHandler(CategoryController.reorderCategories)
  );

  todo //menu created but what data to show to be decided later
// pos menu
// actual ordering to show in menu section for customers or waiters -- cashier screen, tablet app`
router.get("/hierarchy", asyncHandler(CategoryController.getHierarchy));

// get single category
router.get("/:id", asyncHandler(CategoryController.getById));

// get subcategories
router.get("/:id/subcategories", asyncHandler(CategoryController.getSubcategories));

// Toggle category: Deactivate category & Reactivate category
router.patch("/:id/deactivate", asyncHandler(CategoryController.deactivateCategory))
router.patch("/:id/reactivate", asyncHandler(CategoryController.reactivateCategory))

todo
// DELETE category

export default router;