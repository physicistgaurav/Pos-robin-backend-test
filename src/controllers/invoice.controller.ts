import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { InvoiceService } from '../services/invoice.service';
import { INVOICE_RESPONSE } from '../constants/invoice.response';


export class InvoiceController {
  /**
   * Create invoice from order
   */
  static async createInvoice(req: Request, res: Response): Promise<Response> {
    const result = await InvoiceService.createInvoice(req.body);
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.INVOICE_CREATED,
      201
    );
  }

  /**
   * Get all invoices with filters
   */
  static async getInvoices(req: Request, res: Response): Promise<Response> {
    const result = await InvoiceService.getInvoices(req.query);
    return ApiResponse.success(
      res,
      result.invoices,
      INVOICE_RESPONSE.INVOICES_RETRIEVED,
      200,
      result.meta
    );
  }

  /**
   * Get invoice by ID
   */
  static async getInvoiceById(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await InvoiceService.getInvoiceById(id);
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.INVOICE_RETRIEVED,
      200
    );
  }

  /**
   * Update invoice
   */
  static async updateInvoice(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await InvoiceService.updateInvoice(id, req.body);
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.INVOICE_UPDATED,
      200
    );
  }

  /**
   * Delete invoice
   */
  static async deleteInvoice(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    await InvoiceService.deleteInvoice(id);
    return ApiResponse.success(
      res,
      null,
      INVOICE_RESPONSE.INVOICE_DELETED,
      200
    );
  }

  /**
   * Generate PDF (returns invoice data for PDF generation)
   */
  static async generatePDF(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await InvoiceService.generatePDF(id);
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.PDF_GENERATED,
      200
    );
  }

  /**
   * Download PDF (streams PDF file)
   */
  static async downloadPDF(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { pdfBuffer, fileName } = await InvoiceService.downloadPDF(id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  }

  /**
   * Email invoice
   */
  static async emailInvoice(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { email, subject, message, cc } = req.body;
    
    const result = await InvoiceService.emailInvoice(id, {
      email,
      subject,
      message,
      cc,
    });
    
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.EMAIL_SENT,
      200
    );
  }

  /**
   * Record print
   */
  static async recordPrint(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await InvoiceService.recordPrint(id);
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.PRINT_RECORDED,
      200
    );
  }

  /**
   * Get invoice by order ID
   */
  static async getInvoiceByOrderId(req: Request, res: Response): Promise<Response> {
    const { orderId } = req.params;
    const result = await InvoiceService.getInvoiceByOrderId(orderId);
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.INVOICE_RETRIEVED,
      200
    );
  }

  /**
   * Get invoice by invoice number
   */
  static async getInvoiceByNumber(req: Request, res: Response): Promise<Response> {
    const { invoiceNumber } = req.params;
    const result = await InvoiceService.getInvoiceByNumber(invoiceNumber);
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.INVOICE_RETRIEVED,
      200
    );
  }

  /**
   * Get invoice summary
   */
  static async getInvoiceSummary(req: Request, res: Response): Promise<Response> {
    const { start_date, end_date, fiscal_year } = req.query;
    const result = await InvoiceService.getInvoiceSummary({
      start_date: start_date as string,
      end_date: end_date as string,
      fiscal_year: fiscal_year as string,
    });
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.SUMMARY_GENERATED,
      200
    );
  }

  /**
   * Get daily summary
   */
  static async getDailySummary(req: Request, res: Response): Promise<Response> {
    const { date } = req.query;
    const result = await InvoiceService.getDailySummary(date as string);
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.SUMMARY_GENERATED,
      200
    );
  }

  /**
   * Get overdue invoices
   */
  static async getOverdueInvoices(_req: Request, res: Response): Promise<Response> {
    const result = await InvoiceService.getOverdueInvoices();
    return ApiResponse.success(
      res,
      result,
      INVOICE_RESPONSE.OVERDUE_RETRIEVED,
      200
    );
  }

  /**
   * Get invoices by customer
   */
  static async getInvoicesByCustomer(req: Request, res: Response): Promise<Response> {
    const { customerId } = req.params;
    const { page, limit } = req.query;
    
    const result = await InvoiceService.getInvoicesByCustomer(customerId, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    
    return ApiResponse.success(
      res,
      result.invoices,
      INVOICE_RESPONSE.INVOICES_RETRIEVED,
      200,
      result.meta
    );
  }
}