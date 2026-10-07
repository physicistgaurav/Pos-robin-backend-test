import { PoolClient } from "pg";
import { transaction } from "../config/database";
import { INVOICE_ERROR_MESSAGES } from "../constants/invoice.response";
import { CreditCustomerModel } from "../models/credit-customer.model";
import { CreditTransactionModel } from "../models/credit-transaction.model";
import { InvoiceModel } from "../models/invoice.model";
import { OrderModel } from "../models/order.model";
import { ApiError } from "../utils/ApiError";
import { buildPaginationMeta, calculatePagination } from "../utils/helpers";

export interface CreateInvoiceData {
  order_id: string;
  credit_customer_id?: string;
  invoice_type?: string;
  due_date?: string;
  pan_number?: string;
  notes?: string;
  created_by: string;
}

export interface EmailInvoiceData {
  email: string;
  subject?: string;
  message?: string;
  cc?: string[];
}

export class InvoiceService {
  /**
   * Create invoice from order
   */
  static async createInvoice(data: CreateInvoiceData) {
    // 1. Verify order exists
    const order = await OrderModel.findById(data.order_id);
    if (!order) {
      throw ApiError.notFound(INVOICE_ERROR_MESSAGES.ORDER_NOT_FOUND);
    }

    // 2. Check if order is completed
    if (order.status !== "completed") {
      throw ApiError.badRequest(INVOICE_ERROR_MESSAGES.ORDER_NOT_COMPLETED);
    }

    // 3. Check if invoice already exists for this order
    const existing = await InvoiceModel.findByOrderId(data.order_id);
    if (existing) {
      throw ApiError.badRequest(INVOICE_ERROR_MESSAGES.INVOICE_ALREADY_EXISTS);
    }

    if (data.credit_customer_id) {
      // Credit invoice: Use transaction for atomicity and locking to prevent race conditions
      return await transaction(async (client) => {
        // 4. Fetch and lock credit customer
        const customerQuery = `
          SELECT * FROM credit_customers
          WHERE id = $1 FOR UPDATE
        `;
        const customerRes = await client.query(customerQuery, [
          data.credit_customer_id,
        ]);
        let creditCustomer = customerRes.rows[0];

        if (!creditCustomer) {
          throw ApiError.notFound(
            INVOICE_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND
          );
        }

        // Check if customer is active
        if (creditCustomer.status !== "active") {
          throw ApiError.badRequest(INVOICE_ERROR_MESSAGES.CUSTOMER_NOT_ACTIVE);
        }

        // Check credit limit (using locked row for accurate current_balance)
        // Check credit limit (using locked row for accurate current_balance)
        const currentBalance = Number(creditCustomer.current_balance);
        const creditLimit = Number(creditCustomer.credit_limit);
        const orderTotal = Number(order.total_amount); // ← ADD THIS: force to number

        const newBalance = currentBalance + orderTotal;

        console.log("newBalance", newBalance, creditLimit);

        if (newBalance > creditLimit) {
          throw ApiError.badRequest(
            `Credit limit exceeded. Available credit: Rs. ${creditLimit - currentBalance}`
          );
        }

        // 5. Calculate due date if not provided
        let dueDate = data.due_date
          ? new Date(data.due_date).toISOString().split("T")[0]
          : null;
        if (!dueDate && creditCustomer) {
          const invoiceDate = new Date();
          invoiceDate.setDate(
            invoiceDate.getDate() + creditCustomer.payment_terms_days
          );
          dueDate = invoiceDate.toISOString().split("T")[0];
        }

        // 6. Create invoice (override payment_status and paid_amount for credit)
        const invoice = await InvoiceModel.create(
          {
            order_id: data.order_id,
            credit_customer_id: data.credit_customer_id,
            invoice_type: data.invoice_type || "tax_invoice",
            due_date: dueDate ? new Date(dueDate) : null, // Pass as Date or null for pg
            subtotal: order.subtotal,
            discount_amount: order.discount_amount,
            tax_amount: order.tax_amount,
            service_charge_amount: order.service_charge_amount,
            total_amount: order.total_amount,
            pan_number: data.pan_number,
            vat_amount: order.tax_amount, // VAT is the tax in Nepal
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            // customer_email: order.customer_email,
            customer_address: order.delivery_address,
            customer_pan: creditCustomer.pan_number,
            payment_status: "unpaid", // Force for credit
            paid_amount: 0, // Force for credit
            notes: data.notes,
            created_by: data.created_by,
          },
          client
        ); // Pass client for transaction

        // 7. Create charge transaction (do not pass balance_before/after; let DB trigger handle)
        await CreditTransactionModel.create(
          {
            credit_customer_id: creditCustomer.id,
            order_id: order.id,
            invoice_id: invoice.id,
            transaction_type: "charge",
            amount: order.total_amount,
            due_date: dueDate,
            notes: `Invoice ${invoice.invoice_number}`,
            created_by: data.created_by,
          },
          client
        ); // Pass client for transaction

        // 8. Get full invoice details
        return await this.getInvoiceById(invoice.id, client);
      });
    } else {
      // Non-credit invoice
      // 5. Due date optional; defaults to null if not provided
      let dueDate = data.due_date
        ? new Date(data.due_date).toISOString().split("T")[0]
        : null;

      // 6. Create invoice
      const invoice = await InvoiceModel.create({
        order_id: data.order_id,
        credit_customer_id: null,
        invoice_type: data.invoice_type || "tax_invoice",
        due_date: dueDate ? new Date(dueDate) : null,
        subtotal: order.subtotal,
        discount_amount: order.discount_amount,
        tax_amount: order.tax_amount,
        service_charge_amount: order.service_charge_amount,
        total_amount: order.total_amount,
        pan_number: data.pan_number,
        vat_amount: order.tax_amount,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        // customer_email: order.customer_email,
        customer_address: order.delivery_address,
        customer_pan: null,
        payment_status: order.payment_status, // Use order's for non-credit (e.g., 'paid')
        paid_amount: order.paid_amount,
        notes: data.notes,
        created_by: data.created_by,
      });

      // 8. Get full invoice details
      return this.getInvoiceById(invoice.id);
    }
  }

  /**
   * Get all invoices with filters
   */
  static async getInvoices(query: {
    page?: number;
    limit?: number;
    payment_status?: string;
    invoice_type?: string;
    start_date?: string;
    end_date?: string;
    credit_customer_id?: string;
    fiscal_year?: string;
    search?: string;
    is_overdue?: boolean;
  }) {
    const { page = 1, limit = 20, ...filters } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { invoices, total } = await InvoiceModel.findAll({
      ...filters,
      limit: validatedLimit,
      offset,
    });

    return {
      invoices,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  /**
   * Get invoice by ID
   */
  static async getInvoiceById(
    invoiceId: string,
    client?: PoolClient // Optional: pass when inside a transaction
  ): Promise<any> {
    // 1. Fetch invoice with enriched data (recommended: move this logic to model if not already)
    const invoice = await InvoiceModel.findById(invoiceId, client);
    if (!invoice) {
      throw ApiError.notFound(INVOICE_ERROR_MESSAGES.INVOICE_NOT_FOUND);
    }

    // 2. Fetch order details (with items)
    const order = await OrderModel.findById(invoice.order_id);

    // 3. Fetch credit customer if linked
    let creditCustomer: any = null;
    if (invoice.credit_customer_id) {
      creditCustomer = await CreditCustomerModel.findById(
        invoice.credit_customer_id,
        client
      );
    }

    // 4. Calculate overdue status
    const isOverdue = invoice.due_date
      ? new Date(invoice.due_date) < new Date() &&
        invoice.payment_status !== "paid"
      : false;

    const daysOverdue =
      isOverdue && invoice.due_date
        ? Math.floor(
            (Date.now() - new Date(invoice.due_date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

    // 5. Return enriched response
    return {
      ...invoice,
      order,
      credit_customer: creditCustomer,
      is_overdue: isOverdue,
      days_overdue: daysOverdue,
      balance_amount: invoice.total_amount - invoice.paid_amount,
    };
  }

  /**
   * Update invoice
   */
  static async updateInvoice(invoiceId: string, data: any) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound(INVOICE_ERROR_MESSAGES.INVOICE_NOT_FOUND);
    }

    // Prevent updating paid invoices
    if (invoice.payment_status === "paid" && data.total_amount) {
      throw ApiError.notFound(
        INVOICE_ERROR_MESSAGES.CANNOT_UPDATE_PAID_INVOICE
      );
    }

    const updated = await InvoiceModel.update(invoiceId, data);
    return this.getInvoiceById(updated.id);
  }

  /**
   * Delete invoice
   */
  static async deleteInvoice(invoiceId: string) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound(INVOICE_ERROR_MESSAGES.INVOICE_NOT_FOUND);
    }

    // Only allow deletion of unpaid invoices
    if (invoice.payment_status !== "unpaid") {
      throw ApiError.notFound(
        INVOICE_ERROR_MESSAGES.CANNOT_DELETE_PAID_INVOICE
      );
    }

    // Delete associated credit transaction if exists
    if (invoice.credit_customer_id) {
      // This will be handled by database cascade or manually
      // For now, we'll just delete the invoice
    }

    await InvoiceModel.delete(invoiceId);
  }

  /**
   * Generate PDF
   */
  static async generatePDF(invoiceId: string) {
    const invoice = await this.getInvoiceById(invoiceId);

    // Mark as generated
    await InvoiceModel.update(invoiceId, {
      pdf_generated: true,
      pdf_path: `/invoices/${invoice.invoice_number}.pdf`,
    });

    // Return invoice data for PDF generation
    // Frontend or separate service will handle actual PDF generation
    return {
      invoice_number: invoice.invoice_number,
      pdf_url: `/api/invoices/${invoiceId}/pdf/download`,
      invoice_data: invoice,
    };
  }

  /**
   * Download PDF
   */
  static async downloadPDF(invoiceId: string) {
    const invoice = await this.getInvoiceById(invoiceId);

    // TODO: Implement actual PDF generation using puppeteer or pdfkit
    // For now, return mock data
    const pdfBuffer = Buffer.from("PDF content here");
    const fileName = `${invoice.invoice_number}.pdf`;

    return {
      pdfBuffer,
      fileName,
    };
  }

  /**
   * Email invoice
   */
  static async emailInvoice(invoiceId: string, emailData: EmailInvoiceData) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound(INVOICE_ERROR_MESSAGES.INVOICE_NOT_FOUND);
    }

    // TODO: Implement email sending with nodemailer
    // await sendInvoiceEmail(invoice, emailData);

    // Update email tracking
    await InvoiceModel.update(invoiceId, {
      emailed_to: emailData.email,
      emailed_at: new Date(),
      email_count: (invoice.email_count || 0) + 1,
    });

    return {
      success: true,
      emailed_to: emailData.email,
      invoice_number: invoice.invoice_number,
      subject: emailData.subject || `Invoice ${invoice.invoice_number}`,
    };
  }

  /**
   * Record print
   */
  static async recordPrint(invoiceId: string) {
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound(INVOICE_ERROR_MESSAGES.INVOICE_NOT_FOUND);
    }

    const updated = await InvoiceModel.incrementPrintCount(invoiceId);
    return {
      invoice_number: updated.invoice_number,
      printed_count: updated.printed_count,
      last_printed_at: updated.last_printed_at,
    };
  }

  /**
   * Get invoice by order ID
   */
  static async getInvoiceByOrderId(orderId: string) {
    const invoice = await InvoiceModel.findByOrderId(orderId);
    if (!invoice) {
      throw ApiError.notFound(INVOICE_ERROR_MESSAGES.INVOICE_NOT_FOUND);
    }

    return this.getInvoiceById(invoice.id);
  }

  /**
   * Get invoice by invoice number
   */
  static async getInvoiceByNumber(invoiceNumber: string) {
    const invoice = await InvoiceModel.findByInvoiceNumber(invoiceNumber);
    if (!invoice) {
      throw ApiError.notFound(INVOICE_ERROR_MESSAGES.INVOICE_NOT_FOUND);
    }

    return this.getInvoiceById(invoice.id);
  }

  /**
   * Get invoice summary
   */
  static async getInvoiceSummary(filters: {
    start_date?: string;
    end_date?: string;
    fiscal_year?: string;
  }) {
    const summary = await InvoiceModel.getSummary(filters);
    return summary;
  }

  /**
   * Get daily summary
   */
  static async getDailySummary(date?: string) {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const summary = await InvoiceModel.getDailySummary(targetDate);
    return summary;
  }

  /**
   * Get overdue invoices
   */
  static async getOverdueInvoices() {
    const overdue = await InvoiceModel.getOverdueInvoices();

    const summary = {
      total_overdue: overdue.length,
      total_amount: overdue.reduce(
        (sum, inv) => sum + parseFloat(inv.balance_amount.toString()),
        0
      ),
      average_days_overdue:
        overdue.length > 0
          ? overdue.reduce((sum, inv) => sum + inv.days_overdue, 0) /
            overdue.length
          : 0,
    };

    return {
      summary,
      invoices: overdue,
    };
  }

  /**
   * Get invoices by customer
   */
  static async getInvoicesByCustomer(
    customerId: string,
    query: { page?: number; limit?: number }
  ) {
    const customer = await CreditCustomerModel.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(INVOICE_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }

    const { page = 1, limit = 20 } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { invoices, total } = await InvoiceModel.findByCustomerId(
      customerId,
      {
        limit: validatedLimit,
        offset,
      }
    );

    return {
      customer: {
        id: customer.id,
        name: customer.customer_name,
        company: customer.company_name,
        current_balance: customer.current_balance,
      },
      invoices,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }
}
