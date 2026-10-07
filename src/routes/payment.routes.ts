import { Router } from 'express';
import { getPaymentHistorySchema, processPaymentSchema, refundPaymentSchema } from '../validators/payment.validator';
import { validateRequest } from '../middleware/validateRequest';
import { PaymentController } from '../controllers/payment.controller';
import { asyncHandler } from '../middleware/asyncHandler';


const router = Router();

// Process payment (full or partial)
router.post(
  '/:orderId',
  validateRequest(processPaymentSchema),
  asyncHandler(PaymentController.processPayment)
);

// Get payment history for an order
router.get(
    '/:orderId',
    validateRequest(getPaymentHistorySchema),
    asyncHandler(PaymentController.getPaymentHistory)
  );
  
  // Refund a payment
  router.post(
    '/:orderId/refund/:paymentId',
    validateRequest(refundPaymentSchema),
    asyncHandler(PaymentController.refundPayment)
  );
  
  // Get payment summary for an order
  router.get(
    '/:orderId/payment-status',
    validateRequest(getPaymentHistorySchema),
    asyncHandler(PaymentController.getPaymentStatus)
  );

export default router;