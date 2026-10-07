import { CREDIT_ERROR_MESSAGES } from "../constants/credit.response";
import { CreditCustomerModel } from "../models/credit-customer.model";
import { CreditTransactionModel } from "../models/credit-transaction.model";
import { OrderModel } from "../models/order.model";
import { ApiError } from "../utils/ApiError";
import { buildPaginationMeta, calculatePagination } from "../utils/helpers";

export interface CreateCreditCustomerData {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  company_name?: string;
  company_registration?: string;
  pan_number?: string;
  billing_address?: string;
  credit_limit: number;
  payment_terms_days?: number;
  contact_person?: string;
  contact_phone?: string;
  notes?: string;
  internal_notes?: string;

  opening_balance?: number;
  created_by: string;
}

export interface RecordPaymentData {
  amount: number;
  payment_method: string;
  transaction_id?: string;
  reference_number?: string;
  notes?: string;
  created_by: string;
}

export interface AdjustBalanceData {
  amount: number;
  reason: string;
  created_by: string;
}

export class CreditCustomerService {
  /**
   * Create credit customer
   */
  static async createCreditCustomer(data: CreateCreditCustomerData) {
    // Check if phone already exists
    const existing = await CreditCustomerModel.findByPhone(data.customer_phone);
    if (existing) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_EXISTS);
    }

    if (
      typeof data.opening_balance === "number" &&
      data.opening_balance > data.credit_limit
    ) {
      throw ApiError.badRequest("Opening balance cannot exceed credit limit");
    }

    const customer = await CreditCustomerModel.create(data);

    // Create opening balance transaction if needed
    if (data.opening_balance && data.opening_balance > 0) {
      await CreditTransactionModel.create({
        credit_customer_id: customer.id,
        transaction_type: "opening_balance",
        amount: data.opening_balance,
        balance_before: 0,
        balance_after: data.opening_balance,
        notes: "Opening balance",
        created_by: data.created_by,
      });
    }

    return customer;
  }

  /**
   * Get all credit customers
   */
  static async getCreditCustomers(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    has_balance?: boolean;
  }) {
    const { page = 1, limit = 20, ...filters } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { customers, total } = await CreditCustomerModel.findAll({
      ...filters,
      limit: validatedLimit,
      offset,
    });

    return {
      customers,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  /**
   * Get credit customer by ID
   */
  static async getCreditCustomerById(customerId: string) {
    const customer = await CreditCustomerModel.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }

    // Get recent transactions
    const recentTransactions = await CreditTransactionModel.findByCustomerId(
      customerId,
      { limit: 10 }
    );

    // Get summary stats
    const stats = await CreditCustomerModel.getCustomerStats(customerId);

    return {
      ...customer,
      recent_transactions: recentTransactions,
      stats,
    };
  }

  /**
   * Update credit customer
   */
  static async updateCreditCustomer(
    customerId: string,
    data: Partial<CreateCreditCustomerData>
  ) {
    const customer = await CreditCustomerModel.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }

    // If phone is being updated, check uniqueness
    if (
      data.customer_phone &&
      data.customer_phone !== customer.customer_phone
    ) {
      const existing = await CreditCustomerModel.findByPhone(
        data.customer_phone
      );
      if (existing && existing.id !== customerId) {
        throw ApiError.conflict(CREDIT_ERROR_MESSAGES.PHONE_ALREADY_EXISTS);
      }
    }

    const updated = await CreditCustomerModel.update(customerId, data);
    return updated;
  }

  /**
   * Update status
   */
  static async updateStatus(customerId: string, status: string) {
    const customer = await CreditCustomerModel.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }

    // Validate status change
    if (status === "closed" && customer.current_balance > 0) {
      throw ApiError.conflict(CREDIT_ERROR_MESSAGES.CANNOT_CLOSE_WITH_BALANCE);
    }

    const updated = await CreditCustomerModel.updateStatus(customerId, status);
    return updated;
  }
  /**
Get balance
*/

  static async getBalance(customerId: string) {
    const customer = await CreditCustomerModel.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }

    return {
      customer_id: customer.id,
      customer_name: customer.customer_name,
      credit_limit: customer.credit_limit,
      current_balance: customer.current_balance,
      available_credit: customer.available_credit,
      payment_terms_days: customer.payment_terms_days,
      status: customer.status,
    };
  }

  /**

Get account statement
*/
  static async getStatement(
    customerId: string,
    filters: { start_date?: string; end_date?: string }
  ) {
    const customer = await CreditCustomerModel.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }

    const transactions = await CreditTransactionModel.getStatement(
      customerId,
      filters
    );

    // Calculate opening balance
    let openingBalance = 0;
    if (filters.start_date) {
      openingBalance = await CreditTransactionModel.getBalanceAsOf(
        customerId,
        filters.start_date
      );
    }

    return {
      customer: {
        id: customer.id,
        name: customer.customer_name,
        company: customer.company_name,
        phone: customer.customer_phone,
      },
      period: {
        start_date: filters.start_date,
        end_date: filters.end_date,
      },
      opening_balance: openingBalance,
      transactions,
      closing_balance: customer.current_balance,
    };
  }

  /**

Record payment
*/
  static async recordPayment(customerId: string, data: RecordPaymentData) {
    const customer = await CreditCustomerModel.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }

    if (customer.status !== "active") {
      throw ApiError.conflict(CREDIT_ERROR_MESSAGES.CUSTOMER_NOT_ACTIVE);
    }

    if (data.amount <= 0) {
      throw ApiError.conflict(CREDIT_ERROR_MESSAGES.INVALID_PAYMENT_AMOUNT);
    }

    if (data.amount > customer.current_balance) {
      throw ApiError.conflict(CREDIT_ERROR_MESSAGES.PAYMENT_EXCEEDS_BALANCE);
    }

    // Create payment transaction
    const transaction = await CreditTransactionModel.create({
      credit_customer_id: customerId,
      transaction_type: "payment",
      amount: data.amount,
      balance_before: customer.current_balance,
      balance_after: customer.current_balance - data.amount,
      payment_method: data.payment_method,
      transaction_id: data.transaction_id,
      reference_number: data.reference_number,
      notes: data.notes,
      created_by: data.created_by,
    });

    // Get updated customer
    const updatedCustomer = await CreditCustomerModel.findById(customerId);
    if (!updatedCustomer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }

    return {
      transaction,
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.customer_name,
        previous_balance: customer.current_balance,
        current_balance: updatedCustomer.current_balance,
        available_credit: updatedCustomer.available_credit,
      },
    };
  }

  /**

Adjust balance
*/
  static async adjustBalance(customerId: string, data: AdjustBalanceData) {
    const customer = await CreditCustomerModel.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }
    const currentBalanceCents = Math.round(
      Number(customer.current_balance) * 100
    );
    const amountCents = Math.round(Number(data.amount) * 100);

    const newBalanceCents = currentBalanceCents + amountCents;

    if (newBalanceCents < 0) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.BALANCE_CANNOT_BE_NEGATIVE);
    }

    if (newBalanceCents > Math.round(Number(customer.credit_limit) * 100)) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.EXCEEDS_CREDIT_LIMIT);
    }

    const newBalance = Number((newBalanceCents / 100).toFixed(2));

    // Create adjustment transaction
    const transaction = await CreditTransactionModel.create({
      credit_customer_id: customerId,
      transaction_type: "adjustment",
      amount: data.amount,
      balance_before: customer.current_balance,
      balance_after: newBalance,
      notes: data.reason,
      created_by: data.created_by,
    });

    const updatedCustomer = await CreditCustomerModel.findById(customerId);

    if (!updatedCustomer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }

    return {
      transaction,
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.customer_name,
        previous_balance: customer.current_balance,
        current_balance: updatedCustomer.current_balance,
      },
    };
  }

  /**

Get customer orders
*/
  static async getCustomerOrders(
    customerId: string,
    query: { page?: number; limit?: number }
  ) {
    const customer = await CreditCustomerModel.findById(customerId);
    if (!customer) {
      throw ApiError.notFound(CREDIT_ERROR_MESSAGES.CREDIT_CUSTOMER_NOT_FOUND);
    }
    const { page = 1, limit = 20 } = query;
    const { offset, limit: validatedLimit } = calculatePagination(page, limit);

    const { orders, total } = await OrderModel.findByCustomerId(customerId, {
      limit: validatedLimit,
      offset,
    });

    return {
      orders,
      meta: buildPaginationMeta(total, page, validatedLimit),
    };
  }

  /**

Get outstanding report
*/
  static async getOutstandingReport() {
    const outstanding = await CreditCustomerModel.getOutstandingCustomers();
    const summary = {
      total_customers: outstanding.length,
      total_outstanding: outstanding.reduce(
        (sum, c) => sum + parseFloat(c.current_balance.toString()),
        0
      ),
      total_overdue: outstanding.reduce(
        (sum, c) => sum + (c.overdue_invoices || 0),
        0
      ),
    };

    return {
      summary,
      customers: outstanding,
    };
  }

  /**

Get aged receivables
*/
  static async getAgedReceivables() {
    const aged = await CreditCustomerModel.getAgedReceivables();
    const summary = {
      total_outstanding: aged.reduce(
        (sum, c) => sum + parseFloat(c.total_outstanding.toString()),
        0
      ),
      current_0_30: aged.reduce(
        (sum, c) => sum + parseFloat(c.current_0_30.toString()),
        0
      ),
      aged_31_60: aged.reduce(
        (sum, c) => sum + parseFloat(c.aged_31_60.toString()),
        0
      ),
      aged_61_90: aged.reduce(
        (sum, c) => sum + parseFloat(c.aged_61_90.toString()),
        0
      ),
      aged_over_90: aged.reduce(
        (sum, c) => sum + parseFloat(c.aged_over_90.toString()),
        0
      ),
    };

    return {
      summary,
      customers: aged,
    };
  }
}
