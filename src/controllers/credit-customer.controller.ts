import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { CREDIT_RESPONSE } from '../constants/credit.response';
import { CreditCustomerService } from '../services/credit-customer.service';

export class CreditCustomerController {
  /**
   * Create credit customer
   */
  static async createCreditCustomer(req: Request, res: Response): Promise<Response> {
    const result = await CreditCustomerService.createCreditCustomer(req.body);
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.CUSTOMER_CREATED,
      201
    );
  }

  /**
   * Get all credit customers
   */
  static async getCreditCustomers(req: Request, res: Response): Promise<Response> {
    const result = await CreditCustomerService.getCreditCustomers(req.query);
    return ApiResponse.success(
      res,
      result.customers,
      CREDIT_RESPONSE.CUSTOMERS_RETRIEVED,
      200,
      result.meta
    );
  }

  /**
   * Get credit customer by ID
   */
  static async getCreditCustomerById(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await CreditCustomerService.getCreditCustomerById(id);
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.CUSTOMER_RETRIEVED,
      200
    );
  }

  /**
   * Update credit customer
   */
  static async updateCreditCustomer(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await CreditCustomerService.updateCreditCustomer(id, req.body);
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.CUSTOMER_UPDATED,
      200
    );
  }

  /**
   * Update customer status
   */
  static async updateStatus(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { status } = req.body;
    const result = await CreditCustomerService.updateStatus(id, status);
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.STATUS_UPDATED,
      200
    );
  }

  /**
   * Get balance
   */
  static async getBalance(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await CreditCustomerService.getBalance(id);
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.BALANCE_RETRIEVED,
      200
    );
  }

  /**
   * Get account statement
   */
  static async getStatement(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { start_date, end_date } = req.query;
    
    const result = await CreditCustomerService.getStatement(id, {
      start_date: start_date as string,
      end_date: end_date as string,
    });
    
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.STATEMENT_RETRIEVED,
      200
    );
  }

  /**
   * Record payment
   */
  static async recordPayment(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await CreditCustomerService.recordPayment(id, req.body);
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.PAYMENT_RECORDED,
      201
    );
  }

  /**
   * Adjust balance
   */
  static async adjustBalance(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await CreditCustomerService.adjustBalance(id, req.body);
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.BALANCE_ADJUSTED,
      201
    );
  }

  /**
   * Get customer orders
   */
  static async getCustomerOrders(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const result = await CreditCustomerService.getCustomerOrders(id, req.query);
    return ApiResponse.success(
      res,
      result.orders,
      CREDIT_RESPONSE.ORDERS_RETRIEVED,
      200,
      result.meta
    );
  }

  /**
   * Get outstanding report
   */
  static async getOutstandingReport(_req: Request, res: Response): Promise<Response> {
    const result = await CreditCustomerService.getOutstandingReport();
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.REPORT_GENERATED,
      200
    );
  }

  /**
   * Get aged receivables
   */
  static async getAgedReceivables(_req: Request, res: Response): Promise<Response> {
    const result = await CreditCustomerService.getAgedReceivables();
    return ApiResponse.success(
      res,
      result,
      CREDIT_RESPONSE.REPORT_GENERATED,
      200
    );
  }
}