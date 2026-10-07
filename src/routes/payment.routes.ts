import { Router } from 'express';
import { getPaymentHistorySchema, processPaymentSchema, refundPaymentSchema } from '../validators/payment.validator';
import { validateRequest } from '../middleware/validateRequest';
import { PaymentController } from '../controllers/payment.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, authorize } from '../middleware/auth.middleware';


const router = Router();

// All payment endpoints require authentication — these move real money.
router.use(authenticate);

// Process payment (full or partial)
router.post(
  '/:orderId',
  authorize("admin", "manager", "staff"),
  validateRequest(processPaymentSchema),
  asyncHandler(PaymentController.processPayment)
);

// Get payment history for an order
router.get(
    '/:orderId',
    authorize("admin", "manager", "staff"),
    validateRequest(getPaymentHistorySchema),
    asyncHandler(PaymentController.getPaymentHistory)
  );

  // Refund a payment — restricted: refunds change settled money
  router.post(
    '/:orderId/refund/:paymentId',
    authorize("admin", "manager"),
    validateRequest(refundPaymentSchema),
    asyncHandler(PaymentController.refundPayment)
  );

  // Get payment summary for an order
  router.get(
    '/:orderId/payment-status',
    authorize("admin", "manager", "staff"),
    validateRequest(getPaymentHistorySchema),
    asyncHandler(PaymentController.getPaymentStatus)
  );

export default router;