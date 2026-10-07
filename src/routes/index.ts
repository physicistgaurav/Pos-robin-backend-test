import { Router } from "express";
import authRoutes from "./auth.routes";
import menuRoutes from "./menu.routes";
import tableRoutes from "./table.routes";
import categoryRoutes from "./category.routes";
import productRoutes from "./product.routes";

import orderRoutes from "./order.routes";
import analyticsRoutes from "./analytics.routes";
import paymentRoutes from "./payment.routes";
import creditRoutes from "./credit-customer.routes";
import invoiceRoutes from "./invoice.routes";

import inventoryRoutes from "./inventory.routes";
import storeTransactionRoutes from "./store-transaction.routes";

import dashboardRoutes from "./dashboard.routes"
import { logger } from "../utils/logger";

const router = Router();

// Health check endpoint
router.get("/health", (req, res) => {
  const ip = req.ip;
  const userAgent = req.headers["user-agent"];
  logger.info(`✓ Listening on ip ${ip} in user agent:  ${userAgent}`);
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || "v1",
  });
});

// get ip and user agent

router.get("/getIp", (req, res) => {
  const ip = req.ip;
  const userAgent = req.headers["user-agent"];
  logger.info(`✓ Ip: ${ip} and user agent:  ${userAgent}`);
  res.status(200).json({
    success: true,
    data: {
      ip,
      userAgent,
    },
    message: "IP retreival is valid",
    timestamp: new Date().toISOString(),
  });
});
// API routes
router.use("/auth", authRoutes);
router.use("/tables", tableRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes );
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/credit", creditRoutes)
router.use("/invoice", invoiceRoutes)
router.use("/menu", menuRoutes);
router.use("/analytics", analyticsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/store-transactions', storeTransactionRoutes);
router.use("/dashboard", dashboardRoutes)

export default router;
