import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller';
import {
  createInvoiceSchema,
  getInvoiceSchema,
  updateInvoiceSchema,
//   emailInvoiceSchema,
  queryInvoicesSchema,
} from '../validators/invoice.validator';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All invoice endpoints require authentication.
router.use(authenticate);

// Create invoice from order
router.post(
  '/',
  authorize("admin", "manager", "staff"),
  validateRequest(createInvoiceSchema),
  asyncHandler(InvoiceController.createInvoice)
);

// Get all invoices with filters
router.get(
  '/',
  authorize("admin", "manager", "staff"),
  validateRequest(queryInvoicesSchema),
  asyncHandler(InvoiceController.getInvoices)
);

// Get invoice by ID
router.get(
  '/:id',
  authorize("admin", "manager", "staff"),
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.getInvoiceById)
);

// Update invoice — restricted
router.put(
  '/:id',
  authorize("admin", "manager"),
  validateRequest(updateInvoiceSchema),
  asyncHandler(InvoiceController.updateInvoice)
);

// Delete invoice — restricted
router.delete(
  '/:id',
  authorize("admin", "manager"),
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.deleteInvoice)
);

// Generate PDF
router.get(
  '/:id/pdf',
  authorize("admin", "manager", "staff"),
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.generatePDF)
);

// Download PDF
router.get(
  '/:id/pdf/download',
  authorize("admin", "manager", "staff"),
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.downloadPDF)
);

// Email invoice
// router.post(
//   '/:id/email',
//   authorize("admin", "manager", "staff"),
//   validateRequest(emailInvoiceSchema),
//   asyncHandler(InvoiceController.emailInvoice)
// );

// Record print (increment print count)
router.post(
  '/:id/print',
  authorize("admin", "manager", "staff"),
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.recordPrint)
);

// Get invoice by order ID
router.get(
  '/order/:orderId',
  authorize("admin", "manager", "staff"),
  asyncHandler(InvoiceController.getInvoiceByOrderId)
);

// Get invoice by invoice number
router.get(
  '/number/:invoiceNumber',
  authorize("admin", "manager", "staff"),
  asyncHandler(InvoiceController.getInvoiceByNumber)
);

// Reports
router.get(
  '/reports/summary',
  authorize("admin", "manager"),
  asyncHandler(InvoiceController.getInvoiceSummary)
);

// todo later
// router.get(
//   '/reports/daily',
//   asyncHandler(InvoiceController.getDailySummary)
// );

// router.get(
//   '/reports/overdue',
//   asyncHandler(InvoiceController.getOverdueInvoices)
// );

// router.get(
//   '/reports/by-customer/:customerId',
//   asyncHandler(InvoiceController.getInvoicesByCustomer)
// );

export default router;