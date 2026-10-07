import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/asyncHandler';
import { StoreTransactionController } from '../controllers/store-transaction.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createStoreTransactionSchema, updateStoreTransactionSchema,
  getTransactionsSchema, getTransactionByIdSchema, getSummarySchema,
  voidTransactionSchema,
} from '../validators/store-transaction.validator';

const router = Router();

// Financial ledger — authentication + manager-level access on everything.
router.use(authenticate);
router.use(authorize("admin", "manager"));

router.post('/', validateRequest(createStoreTransactionSchema), asyncHandler(StoreTransactionController.create));
router.post('/:id/void', validateRequest(voidTransactionSchema), asyncHandler(StoreTransactionController.void));
router.get('/', validateRequest(getTransactionsSchema), asyncHandler(StoreTransactionController.findAll));
router.get('/summary', validateRequest(getSummarySchema), asyncHandler(StoreTransactionController.getSummary));
router.get('/monthly-pl', asyncHandler(StoreTransactionController.getMonthlyPL));
router.get('/:id', validateRequest(getTransactionByIdSchema), asyncHandler(StoreTransactionController.findById));
router.put('/:id', validateRequest(updateStoreTransactionSchema), asyncHandler(StoreTransactionController.update));

// Hard delete intentionally disabled: the void endpoint is the only
// supported correction path, so the ledger stays auditable.
// router.delete('/:id', validateRequest(getTransactionByIdSchema), asyncHandler(StoreTransactionController.delete));

export default router;