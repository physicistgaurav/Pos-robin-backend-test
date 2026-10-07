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

const router = Router();

// Create invoice from order
router.post(
  '/',
  validateRequest(createInvoiceSchema),
  asyncHandler(InvoiceController.createInvoice)
);

// Get all invoices with filters
router.get(
  '/',
  validateRequest(queryInvoicesSchema),
  asyncHandler(InvoiceController.getInvoices)
);

// Get invoice by ID
router.get(
  '/:id',
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.getInvoiceById)
);

// Update invoice
router.put(
  '/:id',
  validateRequest(updateInvoiceSchema),
  asyncHandler(InvoiceController.updateInvoice)
);

// Delete invoice
router.delete(
  '/:id',
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.deleteInvoice)
);

// Generate PDF
router.get(
  '/:id/pdf',
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.generatePDF)
);

// Download PDF
router.get(
  '/:id/pdf/download',
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.downloadPDF)
);

// Email invoice
// router.post(
//   '/:id/email',
//   validateRequest(emailInvoiceSchema),
//   asyncHandler(InvoiceController.emailInvoice)
// );

// Record print (increment print count)
router.post(
  '/:id/print',
  validateRequest(getInvoiceSchema),
  asyncHandler(InvoiceController.recordPrint)
);

// Get invoice by order ID
router.get(
  '/order/:orderId',
  asyncHandler(InvoiceController.getInvoiceByOrderId)
);

// Get invoice by invoice number
router.get(
  '/number/:invoiceNumber',
  asyncHandler(InvoiceController.getInvoiceByNumber)
);

// Reports
router.get(
  '/reports/summary',
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