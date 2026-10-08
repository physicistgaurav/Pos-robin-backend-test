import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/asyncHandler';
import { adjustBalanceSchema, createCreditCustomerSchema, getCreditCustomerSchema, queryCustomersSchema, recordPaymentSchema, updateCreditCustomerSchema, updateCreditCustomerStatus } from '../validators/credit-customer.validator';
import { CreditCustomerController } from '../controllers/credit-customer.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';



const router = Router();

// All routes require authentication
router.use(authenticate);

// Credit customer CRUD
router.post(
  '/create-customer',
  authorize("admin", "manager"),
  validateRequest(createCreditCustomerSchema),
  asyncHandler(CreditCustomerController.createCreditCustomer)
);

router.get(
  '/customers',

  validateRequest(queryCustomersSchema),
  asyncHandler(CreditCustomerController.getCreditCustomers)
);

router.get(
  '/customer/:id',
  validateRequest(getCreditCustomerSchema),
  asyncHandler(CreditCustomerController.getCreditCustomerById)
);

router.put(
  '/customer/:id',
  validateRequest(updateCreditCustomerSchema),
  authorize("admin", "manager"),
  asyncHandler(CreditCustomerController.updateCreditCustomer)
);

router.patch(
  '/customer/:id/status',
  authorize("admin", "manager"),
  validateRequest(updateCreditCustomerStatus),
  asyncHandler(CreditCustomerController.updateStatus)
);

// Balance & Transactions
router.get(
  '/customer/:id/balance',
  validateRequest(getCreditCustomerSchema),
  asyncHandler(CreditCustomerController.getBalance)
);

router.get(
  '/customer/:id/statement',
  validateRequest(getCreditCustomerSchema),
  asyncHandler(CreditCustomerController.getStatement)
);

router.post(
  '/customer/:id/payment',
  authorize("admin", "manager"),
  validateRequest(recordPaymentSchema),
  asyncHandler(CreditCustomerController.recordPayment)
);

router.post(
  '/customer/:id/adjustments',
  authorize("admin", "manager"),
  validateRequest(adjustBalanceSchema),
  asyncHandler(CreditCustomerController.adjustBalance)
);

// Orders
router.get(
  '/customer/:id/orders',
  validateRequest(getCreditCustomerSchema),
  asyncHandler(CreditCustomerController.getCustomerOrders)
);

// Reports
router.get(
  '/customer/reports/outstanding',
  asyncHandler(CreditCustomerController.getOutstandingReport)
);

router.get(
  '/customer/reports/aged-receivables',
  asyncHandler(CreditCustomerController.getAgedReceivables)
);

export default router;