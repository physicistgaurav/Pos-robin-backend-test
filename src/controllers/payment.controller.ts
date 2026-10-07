import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { PAYMENT_RESPONSE } from '../constants/payment.response';
import { PaymentService } from '../services/payment.service';


export class PaymentController {

      /**
   * Process payment for an order
   */
  static async processPayment(req: Request, res: Response): Promise<Response> {
    const { orderId } = req.params;
    const paymentData = req.body;

    const result = await PaymentService.processPayment(orderId, paymentData);

    return ApiResponse.success(
      res,
      result,
      PAYMENT_RESPONSE.PAYMENT_PROCESSED,
      201
    );
  }

   /**
   * Get payment history for an order
   */
   static async getPaymentHistory(
    req: Request,
    res: Response
  ): Promise<Response> {
    const { orderId } = req.params;

    const result = await PaymentService.getPaymentHistory(orderId);

    return ApiResponse.success(
      res,
      result,
      PAYMENT_RESPONSE.PAYMENT_HISTORY_RETRIEVED,
      200
    );
  }

  /**
   * Refund a payment
   */
  static async refundPayment(req: Request, res: Response): Promise<Response> {
    const { orderId, paymentId } = req.params;
    const refundData = req.body;

    const result = await PaymentService.refundPayment(
      orderId,
      paymentId,
      refundData
    );

    return ApiResponse.success(
      res,
      result,
      PAYMENT_RESPONSE.REFUND_PROCESSED,
      201
    );
  }

    /**
   * Get payment status summary
   */
    static async getPaymentStatus(
        req: Request,
        res: Response
      ): Promise<Response> {
        const { orderId } = req.params;
    
        const result = await PaymentService.getPaymentStatus(orderId);
    
        return ApiResponse.success(
          res,
          result,
          PAYMENT_RESPONSE.PAYMENT_STATUS_RETRIEVED,
          200
        );
      }

}