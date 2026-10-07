import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/asyncHandler';
import { StoreTransactionController } from '../controllers/store-transaction.controller';
import {
  createStoreTransactionSchema, updateStoreTransactionSchema,
  getTransactionsSchema, getTransactionByIdSchema, getSummarySchema,
  voidTransactionSchema,
} from '../validators/store-transaction.validator';

const router = Router();

router.post('/', validateRequest(createStoreTransactionSchema), asyncHandler(StoreTransactionController.create));
router.post('/:id/void', validateRequest(voidTransactionSchema), asyncHandler(StoreTransactionController.void));
router.get('/', validateRequest(getTransactionsSchema), asyncHandler(StoreTransactionController.findAll));
router.get('/summary', validateRequest(getSummarySchema), asyncHandler(StoreTransactionController.getSummary));
router.get('/monthly-pl', asyncHandler(StoreTransactionController.getMonthlyPL));
router.get('/:id', validateRequest(getTransactionByIdSchema), asyncHandler(StoreTransactionController.findById));
router.put('/:id', validateRequest(updateStoreTransactionSchema), asyncHandler(StoreTransactionController.update));

// dont do,,,only at absolutely needed bhane
router.delete('/:id', validateRequest(getTransactionByIdSchema), asyncHandler(StoreTransactionController.delete));

export default router;