import { query } from "../config/database";
import { lastNNPTDays, nptDayEndUTC, nptDayStartUTC, todayNPT } from "../utils/dateRange";

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';


// function getNepalDate(): { yyyy: number; mm: number; dd: number; dayOfWeek: number } {
//   const now = new Date();
//   const nepalOffset = 5 * 60 + 45; // UTC+05:45 in minutes
//   const utc = now.getTime() + now.getTimezoneOffset() * 60000;
//   const nepal = new Date(utc + nepalOffset * 60000);

//   return {
//     yyyy:      nepal.getFullYear(),
//     mm:        nepal.getMonth(),       // 0-indexed
//     dd:        nepal.getDate(),
//     dayOfWeek: nepal.getDay(),         // 0=Sun, 1=Mon ... 6=Sat
//   };
// }

// function defaultDateRangeSales(period: Period): { from: string; to: string } {
//   const { yyyy, mm, dd, dayOfWeek } = getNepalDate();

//   let from: Date;
//   let to: Date;

//   switch (period) {
//     case 'daily':
//       from = new Date(yyyy, mm, dd);
//       to   = new Date(yyyy, mm, dd);
//       break;

//     case 'weekly': {
//       // Monday = start of week
//       const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
//       const monday = dd - daysFromMonday;
//       from = new Date(yyyy, mm, monday);
//       to   = new Date(yyyy, mm, monday + 6);
//       break;
//     }

//     case 'monthly':
//       from = new Date(yyyy, mm, 1);
//       to   = new Date(yyyy, mm + 1, 0); // day 0 of next month = last day of current month
//       break;

//     case 'yearly':
//       from = new Date(yyyy, 0, 1);
//       to   = new Date(yyyy, 11, 31);
//       break;

//     default:
//       from = new Date(yyyy, mm, dd);
//       to   = new Date(yyyy, mm, dd);
//   }

//   const fmt = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

//   return { from: fmt(from), to: fmt(to) };
// }

function periodTrunc(period: Period): string {
  switch (period) {
    case 'daily':   return 'day';
    case 'weekly':  return 'week';
    case 'monthly': return 'month';
    case 'yearly':  return 'year';
    default:        return 'day';
  }
}


// ── Zero-value guard so the response shape is always consistent ──────────
function zeroSummary() {
  return {
    total_orders:    0,
    items_sold:      0,
    unique_products: 0,
    revenue:         0,
    revenue_pct:     0,
    avg_item_price:  0,
  };
}





// function getPeriodColumn(period: Period) {
//   switch (period) {
//     case 'weekly':
//       return 'period_week';
//     case 'monthly':
//       return 'period_month';
//     case 'yearly':
//       return 'period_year';
//     default:
//       return 'period_day';
//   }
// }

export class DashboardService {

    // ─── 1. OVERVIEW ────────────────────────────────────────────────────────
    static async getOverview() {
      const [
        todayResult,
        yesterdayResult,
        paymentResult,
        creditResult,
        inventoryResult,
        storePlResult,
        tableResult,
      ] = await Promise.all([
        query(`SELECT * FROM v_today_overview`),
        query(`
          SELECT
            COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) AS revenue,
            COUNT(*) FILTER (WHERE status = 'completed')                       AS orders
          FROM orders
          WHERE (order_time AT TIME ZONE 'Asia/Kathmandu')::date
              = (NOW() AT TIME ZONE 'Asia/Kathmandu')::date - 1
        `),
        query(`SELECT * FROM v_today_payment_breakdown`),
        query(`SELECT * FROM v_today_credit_activity`),
        query(`SELECT * FROM low_stock_products`),
        query(`
          SELECT
            COALESCE(SUM(amount) FILTER (
              WHERE type = 'incoming' AND status = 'active'
            ), 0) AS this_month_income,
            COALESCE(SUM(amount) FILTER (
              WHERE type = 'outgoing' AND status = 'active'
            ), 0) AS this_month_expense
          FROM store_transactions
          WHERE DATE_TRUNC('month', transaction_date AT TIME ZONE 'Asia/Kathmandu')
              = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kathmandu')
        `),
        query(`SELECT * FROM v_table_occupancy`),
      ]);
  
      const today = todayResult.rows[0];
      const yd    = yesterdayResult.rows[0];
      const pl    = storePlResult.rows[0];
  
      const revenueChangePct =
        parseFloat(yd.revenue) > 0
          ? (
              ((parseFloat(today.total_revenue) - parseFloat(yd.revenue)) /
                parseFloat(yd.revenue)) *
              100
            ).toFixed(1)
          : null;
  
      const alertProducts = inventoryResult.rows.filter(
        (r: any) => r.stock_status !== 'ok'
      );
  
      return {
        today_sales: {
          total_orders:          today.total_orders,
          completed_orders:      today.completed_orders,
          cancelled_orders:      today.cancelled_orders,
          pending_orders:        today.pending_orders,
          active_orders:         today.active_orders,
          total_revenue:         parseFloat(today.total_revenue),
          total_tax:             parseFloat(today.total_tax),
          total_discounts:       parseFloat(today.total_discounts),
          total_service_charge:  parseFloat(today.total_service_charge),
          avg_order_value:       parseFloat(today.avg_order_value),
          total_unpaid_amount:   parseFloat(today.total_unpaid_amount),
          by_order_type: {
            dine_in:   parseFloat(today.dine_in_revenue),
            takeaway:  parseFloat(today.takeaway_revenue),
            delivery:  parseFloat(today.delivery_revenue),
            credit:    parseFloat(today.credit_revenue),
          },
          vs_yesterday: {
            revenue_change_pct: revenueChangePct,
            orders_change:
              parseInt(today.completed_orders) - parseInt(yd.orders),
          },
        },
        payment_breakdown: paymentResult.rows,
        credit_activity:   creditResult.rows[0],
        inventory_alerts: {
          out_of_stock_count: alertProducts.filter(
            (r: any) => r.stock_status === 'out_of_stock'
          ).length,
          low_stock_count: alertProducts.filter(
            (r: any) => r.stock_status === 'low_stock'
          ).length,
          alert_products: alertProducts.slice(0, 10),
        },
        store_pl: {
          this_month_income:  parseFloat(pl.this_month_income),
          this_month_expense: parseFloat(pl.this_month_expense),
          net:
            parseFloat(pl.this_month_income) -
            parseFloat(pl.this_month_expense),
        },
        table_occupancy: tableResult.rows[0],
      };
    }
  
    // ─── 2. SALES SUMMARY (date range) ──────────────────────────────────────
    // from/to arrive as UTC ISO instants that already represent exact
    // Kathmandu (NPT) window boundaries — resolved by resolveDateRange.
    // They are used as-is: no +1 day, no server-local date math.
    static async getSalesSummary(from: string, to: string) {
      const fromTs = new Date(from).toISOString();
      const toTs = new Date(to).toISOString();
    
      const [
        summaryResult,
        ordersOverTimeResult,
        paymentMethodsResult,
        topProductsResult,
        orderTypeSplitResult,
      ] = await Promise.all([
        // ─────────────────────────────────────────────
        // 1. CORE SUMMARY (FIXED + CLEANED)
        // ─────────────────────────────────────────────
        query(
          `
          SELECT
            /* ───── ORDERS ───── */
            COUNT(*) AS total_orders,
    
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
    
            ROUND(
              COUNT(*) FILTER (WHERE status = 'cancelled') * 100.0
              / NULLIF(COUNT(*), 0),
            2) AS cancellation_rate_pct,
    
            /* ───── SALES CORE ───── */
            /* Completed orders only: cancelled/pending orders never
               collected money, so they must not inflate revenue KPIs. */
            COALESCE(SUM(subtotal) FILTER (WHERE status = 'completed'), 0) AS gross_sales,
    
            COALESCE(SUM(discount_amount) FILTER (WHERE status = 'completed'), 0) AS total_discounts,
    
            COALESCE(SUM(subtotal - discount_amount) FILTER (WHERE status = 'completed'), 0) AS net_sales,
    
            COALESCE(SUM(tax_amount) FILTER (WHERE status = 'completed'), 0) AS total_tax,
            COALESCE(SUM(service_charge_amount) FILTER (WHERE status = 'completed'), 0) AS total_service_charge,
    
            /* ───── REAL MONEY FLOW ─────
               cash_collected = money actually received in the window on order
               payments (cash, card, wallets) MINUS refunds paid out in the window.
               'credit' is NOT money received - it is a receivable, reported
               separately as credit_sales / credit_repayments_received.
               Payments later fully refunded (status 'refunded') still count as
               received here because their refund is subtracted below. */
            (
              SELECT COALESCE(SUM(op.amount), 0)
              FROM order_payments op
              WHERE op.status IN ('completed', 'refunded')
                AND op.payment_method <> 'credit'
                AND op.payment_date BETWEEN $1 AND $2
            ) - (
              SELECT COALESCE(SUM(r.refund_amount), 0)
              FROM order_refunds r
              WHERE r.refund_method <> 'credit'
                AND r.refund_date BETWEEN $1 AND $2
            ) AS cash_collected,

            (
              SELECT COALESCE(SUM(r.refund_amount), 0)
              FROM order_refunds r
              WHERE r.refund_date BETWEEN $1 AND $2
            ) AS refunds_issued,

            (
              SELECT COALESCE(SUM(ct.amount), 0)
              FROM credit_transactions ct
              WHERE ct.transaction_type = 'charge'
                AND ct.transaction_date BETWEEN $1 AND $2
            ) AS credit_sales,

            (
              SELECT COALESCE(SUM(ct.amount), 0)
              FROM credit_transactions ct
              WHERE ct.transaction_type = 'payment'
                AND ct.transaction_date BETWEEN $1 AND $2
            ) AS credit_repayments_received,

            /* Completed orders still owing money: what is LEFT to collect
               (balance_amount), not the full bill of part-paid orders. */
            COALESCE(SUM(balance_amount) FILTER (
              WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial')
            ), 0) AS outstanding_amount,

            /* Orders still open (not yet completed / cancelled) - not receivables yet. */
            COALESCE(SUM(total_amount) FILTER (
              WHERE status NOT IN ('completed', 'cancelled')
            ), 0) AS open_orders_amount,

            /* ───── AOV ───── */
            ROUND(
              AVG(total_amount) FILTER (WHERE status = 'completed'),
            2) AS avg_order_value,
    
            MAX(total_amount) FILTER (WHERE status = 'completed') AS max_order_value,
            MIN(total_amount) FILTER (WHERE status = 'completed') AS min_order_value,
    
            /* ───── ITEM INSIGHTS ───── */
            (
              SELECT COALESCE(SUM(oi.quantity), 0)
              FROM order_items oi
              JOIN orders o ON o.id = oi.order_id
              WHERE o.order_time BETWEEN $1 AND $2
              AND o.status = 'completed'
            ) AS total_items_sold,
    
            (
              SELECT COUNT(DISTINCT oi.product_id)
              FROM order_items oi
              JOIN orders o ON o.id = oi.order_id
              WHERE o.order_time BETWEEN $1 AND $2
              AND o.status = 'completed'
            ) AS unique_products_sold
    
          FROM orders
          WHERE order_time BETWEEN $1 AND $2
          `,
          [fromTs, toTs]
        ),
    
        // ─────────────────────────────────────────────
        // 2. ORDERS OVER TIME (UNCHANGED)
        // ─────────────────────────────────────────────
        query(
          `
          SELECT
            TO_CHAR(
              order_time AT TIME ZONE 'Asia/Kathmandu',
              'YYYY-MM-DD'
            ) AS date,
            COUNT(*) AS total_orders,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
            COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) AS revenue
          FROM orders
          WHERE order_time BETWEEN $1 AND $2
          GROUP BY 1
          ORDER BY 1 ASC
          `,
          [fromTs, toTs]
        ),
    
        // ─────────────────────────────────────────────
        // 3. PAYMENT BREAKDOWN (UNCHANGED BUT SAFE)
        // ─────────────────────────────────────────────
        query(
          `
          SELECT
            op.payment_method,
            COUNT(*) AS transaction_count,
            SUM(op.amount) AS total_amount,
            ROUND(
              SUM(op.amount) * 100.0 / NULLIF(SUM(SUM(op.amount)) OVER (), 0),
            2) AS percentage
          FROM order_payments op
          JOIN orders o ON op.order_id = o.id
          WHERE op.status = 'completed'
            AND op.payment_date BETWEEN $1 AND $2
          GROUP BY op.payment_method
          ORDER BY total_amount DESC
          `,
          [fromTs, toTs]
        ),
    
        // ─────────────────────────────────────────────
        // 4. TOP PRODUCTS (UNCHANGED)
        // ─────────────────────────────────────────────
        query(
          `
          SELECT
            p.id,
            p.name,
            p.department,
            c.name AS category_name,
    
            SUM(oi.quantity) AS total_qty_sold,
            SUM(oi.total_price) AS total_revenue,
            COUNT(DISTINCT oi.order_id) AS order_count,
    
            ROUND(AVG(oi.unit_price), 2) AS avg_selling_price,
    
            ROUND(
              SUM(oi.total_price) * 100.0 / NULLIF(SUM(SUM(oi.total_price)) OVER (), 0),
            2) AS revenue_pct
    
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          JOIN categories c ON p.category_id = c.id
          JOIN orders o ON oi.order_id = o.id
    
          WHERE o.status = 'completed'
            AND o.order_time BETWEEN $1 AND $2
    
          GROUP BY p.id, p.name, p.department, c.name
          ORDER BY total_revenue DESC
          LIMIT 10
          `,
          [fromTs, toTs]
        ),
    
        // ─────────────────────────────────────────────
        // 5. ORDER TYPE SPLIT (FIXED NULL SAFETY)
        // ─────────────────────────────────────────────
        query(
          `
          SELECT
            order_type,
            COUNT(*) AS order_count,
    
            COALESCE(SUM(total_amount) FILTER (WHERE status='completed'), 0) AS revenue,
    
            ROUND(
              COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0),
            2) AS pct_of_orders
    
          FROM orders
          WHERE order_time BETWEEN $1 AND $2
          GROUP BY order_type
          ORDER BY order_count DESC
          `,
          [fromTs, toTs]
        ),
      ]);
    
      const s = summaryResult.rows[0];
    
      return {
        summary: {
          /* ───── ORDERS ───── */
          total_orders: Number(s.total_orders),
          completed_orders: Number(s.completed_orders),
          cancelled_orders: Number(s.cancelled_orders),
          pending_orders: Number(s.pending_orders),
          cancellation_rate_pct: Number(s.cancellation_rate_pct),
    
          /* ───── SALES (CORE KPI) ───── */
          gross_sales: Number(s.gross_sales),
          total_discounts: Number(s.total_discounts),
          net_sales: Number(s.net_sales),
    
          total_tax: Number(s.total_tax),
          total_service_charge: Number(s.total_service_charge),
    
          /* ───── CASH FLOW ───── */
          cash_collected: Number(s.cash_collected),
          refunds_issued: Number(s.refunds_issued),
          credit_sales: Number(s.credit_sales),
          credit_repayments_received: Number(s.credit_repayments_received),
          outstanding_amount: Number(s.outstanding_amount),
          open_orders_amount: Number(s.open_orders_amount),
    
          /* ───── PERFORMANCE ───── */
          avg_order_value: Number(s.avg_order_value),
          max_order_value: Number(s.max_order_value),
          min_order_value: Number(s.min_order_value),
    
          /* ───── PRODUCT INSIGHTS ───── */
          total_items_sold: Number(s.total_items_sold),
          unique_products_sold: Number(s.unique_products_sold),
        },
    
        orders_over_time: ordersOverTimeResult.rows,
        payment_methods: paymentMethodsResult.rows,
        top_products: topProductsResult.rows,
        order_type_split: orderTypeSplitResult.rows,
      };
    }


  
    // ─── 3. FOOD VS DRINK ───────────────────────────────────────────────────
  // In DashboardService

    static async getFoodDrinkSales(from: string, to: string) {
      // from/to are UTC ISO instants of exact NPT window boundaries
      // (resolved by resolveDateRange) — used as-is.
      const fromTs = new Date(from).toISOString();
      const toTs   = new Date(to).toISOString();

      const [
        summaryResult,
        overTimeResult,
        byMainCategoryResult,
        bySubCategoryResult,
        topProductsResult,
      ] = await Promise.all([

        // 1. CORE SUMMARY
query(`
  SELECT
    item_type                              AS department,
    COUNT(DISTINCT order_id)               AS total_orders,
    SUM(quantity)                          AS items_sold,
    COUNT(DISTINCT product_id)             AS unique_products,
    COALESCE(SUM(total_price), 0)          AS revenue,
    ROUND(
      SUM(total_price) * 100.0
      / NULLIF(SUM(SUM(total_price)) OVER (), 0),
    2)                                     AS revenue_pct,
    ROUND(
      SUM(total_price) / NULLIF(SUM(quantity), 0),
    2)                                     AS avg_item_price
  FROM v_food_drink_sales
  WHERE period_day >= ($1::timestamptz AT TIME ZONE 'Asia/Kathmandu')
    AND period_day <= ($2::timestamptz AT TIME ZONE 'Asia/Kathmandu')
  GROUP BY item_type
  ORDER BY revenue DESC
`, [fromTs, toTs]),

// 2. TREND OVER TIME
query(`
  SELECT
    TO_CHAR(
      period_day,
      'YYYY-MM-DD'
    )                            AS date,
    item_type                    AS department,
    COUNT(DISTINCT order_id)     AS order_count,
    SUM(quantity)                AS items_sold,
    SUM(total_price)             AS revenue
  FROM v_food_drink_sales
  WHERE period_day >= ($1::timestamptz AT TIME ZONE 'Asia/Kathmandu')
    AND period_day <= ($2::timestamptz AT TIME ZONE 'Asia/Kathmandu')
  GROUP BY period_day, item_type
  ORDER BY 1 ASC, 2 ASC
`, [fromTs, toTs]),

// 3. BY MAIN CATEGORY
query(`
  SELECT
    item_type                              AS department,
    COALESCE(main_category_name,
             sub_category_name)            AS category_name,
    COALESCE(main_category_id,
             sub_category_id)              AS category_id,
    COUNT(DISTINCT order_id)               AS order_count,
    SUM(quantity)                          AS items_sold,
    COUNT(DISTINCT product_id)             AS products_count,
    SUM(total_price)                       AS revenue,
    ROUND(
      SUM(total_price) * 100.0
      / NULLIF(SUM(SUM(total_price)) OVER (PARTITION BY item_type), 0),
    2)                                     AS revenue_pct_within_dept
  FROM v_food_drink_sales
  WHERE period_day >= ($1::timestamptz AT TIME ZONE 'Asia/Kathmandu')
    AND period_day <= ($2::timestamptz AT TIME ZONE 'Asia/Kathmandu')
    AND main_category_id IS NOT NULL
  GROUP BY item_type, category_name, category_id
  ORDER BY item_type, revenue DESC
`, [fromTs, toTs]),

// 4. BY SUB-CATEGORY
query(`
  SELECT
    item_type                              AS department,
    main_category_name,
    sub_category_name,
    sub_category_id,
    COUNT(DISTINCT order_id)               AS order_count,
    SUM(quantity)                          AS items_sold,
    SUM(total_price)                       AS revenue,
    ROUND(
      SUM(total_price) * 100.0
      / NULLIF(SUM(SUM(total_price)) OVER (PARTITION BY item_type), 0),
    2)                                     AS revenue_pct_within_dept
  FROM v_food_drink_sales
  WHERE period_day >= ($1::timestamptz AT TIME ZONE 'Asia/Kathmandu')
    AND period_day <= ($2::timestamptz AT TIME ZONE 'Asia/Kathmandu')
  GROUP BY item_type, main_category_name, sub_category_name, sub_category_id
  ORDER BY item_type, revenue DESC
`, [fromTs, toTs]),

// 5. TOP PRODUCTS PER DEPARTMENT
query(`
  WITH ranked AS (
    SELECT
      item_type                              AS department,
      product_id,
      -- fetch name & category separately since view no longer has them
      MIN(sub_category_name)                 AS category_name,
      SUM(quantity)                          AS qty_sold,
      SUM(total_price)                       AS revenue,
      COUNT(DISTINCT order_id)               AS order_count,
      ROUND(
        SUM(total_price) / NULLIF(SUM(quantity), 0),
      2)                                     AS avg_price,
      ROUND(
        SUM(total_price) * 100.0
        / NULLIF(SUM(SUM(total_price)) OVER (PARTITION BY item_type), 0),
      2)                                     AS revenue_pct_within_dept,
      ROW_NUMBER() OVER (
        PARTITION BY item_type
        ORDER BY SUM(total_price) DESC
      )                                      AS rn
    FROM v_food_drink_sales
    WHERE period_day >= ($1::timestamptz AT TIME ZONE 'Asia/Kathmandu')
    AND period_day <= ($2::timestamptz AT TIME ZONE 'Asia/Kathmandu')
    GROUP BY item_type, product_id
  )
  SELECT r.*, p.name AS product_name
  FROM ranked r
  JOIN products p ON r.product_id = p.id
  WHERE rn <= 10
  ORDER BY department, rn
`, [fromTs, toTs]),
    ]);

      // ── Shape the summary into { kitchen: {...}, bar: {...}, combined: {...} }
      const byDept: Record<string, {
        total_orders:     number;
        items_sold:       number;
        unique_products:  number;
        revenue:          number;
        revenue_pct:      number;
        avg_item_price:   number;
      }> = {};

      for (const row of summaryResult.rows) {
        byDept[row.department] = {
          total_orders:    Number(row.total_orders),
          items_sold:      Number(row.items_sold),
          unique_products: Number(row.unique_products),
          revenue:         Number(row.revenue),
          revenue_pct:     Number(row.revenue_pct),
          avg_item_price:  Number(row.avg_item_price),
        };
      }

      const kitchen = byDept['kitchen'] ?? zeroSummary();
      const bar      = byDept['bar']     ?? zeroSummary();

      return {
        summary: {
          kitchen,
          bar,
          combined: {
            total_orders:    kitchen.total_orders    + bar.total_orders,
            items_sold:      kitchen.items_sold      + bar.items_sold,
            unique_products: kitchen.unique_products + bar.unique_products,
            revenue:         kitchen.revenue         + bar.revenue,
          },
        },

        trend:            overTimeResult.rows,
        by_main_category: byMainCategoryResult.rows,
        by_sub_category:  bySubCategoryResult.rows,
        top_products:     topProductsResult.rows,
      };
    }  

    // ─── 4. SALES CHART ─────────────────────────────────────────────────────
    static async getSalesChart(period: Period, from?: string, to?: string) {
      // Raw query params are Kathmandu calendar days; fall back to last 30 NPT days.
      const range = from && to
        ? { from: nptDayStartUTC(from), to: nptDayEndUTC(to) }
        : lastNNPTDays(30);
      const trunc = periodTrunc(period);

      const result = await query(
        `
        SELECT
          DATE_TRUNC('${trunc}', order_time AT TIME ZONE 'Asia/Kathmandu')      AS period,
          COUNT(*)                                                              AS total_orders,
          COUNT(*) FILTER (WHERE status = 'completed')                         AS completed_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled')                         AS cancelled_orders,
          COALESCE(SUM(total_amount)    FILTER (WHERE status='completed'), 0)  AS revenue,
          COALESCE(SUM(tax_amount)      FILTER (WHERE status='completed'), 0)  AS tax,
          COALESCE(SUM(discount_amount) FILTER (WHERE status='completed'), 0)  AS discounts,
          ROUND(AVG(total_amount)       FILTER (WHERE status='completed'), 2)  AS avg_order_value
        FROM orders
        WHERE order_time BETWEEN $1 AND $2
        GROUP BY 1
        ORDER BY 1 ASC
        `,
        [range.from, range.to]
      );
  
      return result.rows;
    }
  
    // ─── 5. TOP PRODUCTS (FIXED) ─────────────────────────────────────────────
    static async getTopProducts(filters: {
      from:         string;
      to:           string;
      limit?:       number;
      category_id?: string;
    }) {
      // from/to are UTC ISO instants of exact NPT window boundaries
      // (resolved by resolveDateRange) — used as-is.
      const fromTs = new Date(filters.from).toISOString();
      const toTs = new Date(filters.to).toISOString();
      // Guard the limit: default 10, hard cap 100 — unbounded product
      // dumps were killing the dashboard.
      const limit = Math.min(Math.max(Math.floor(filters.limit ?? 10) || 10, 1), 100);

      const conditions = [
        `o.status = 'completed'`,
        `o.order_time >= $1`,
        `o.order_time <  $2`,
      ];

      const values: any[] = [fromTs, toTs];
      let idx = 3;

      if (filters.category_id) {
        conditions.push(`p.category_id = $${idx++}`);
        values.push(filters.category_id);
      }

      values.push(limit);
    
      const result = await query(
        `
        SELECT
          p.id,
          p.name,
          p.department,
          p.selling_price,
          c.name                         AS category_name,
          c2.name                        AS main_category_name,
          SUM(oi.quantity)               AS total_qty_sold,
          SUM(oi.total_price)            AS total_revenue,
          COUNT(DISTINCT oi.order_id)    AS order_count,
          ROUND(AVG(oi.unit_price), 2)   AS avg_selling_price,
          ROUND(
            SUM(oi.total_price) * 100.0
            / NULLIF(SUM(SUM(oi.total_price)) OVER (), 0),
          2)                             AS revenue_pct
        FROM order_items  oi
        JOIN products     p   ON oi.product_id = p.id
        JOIN categories   c   ON p.category_id = c.id
        LEFT JOIN categories c2 ON c.parent_id = c2.id
        JOIN orders       o   ON oi.order_id   = o.id
        WHERE ${conditions.join(' AND ')}
        GROUP BY p.id, p.name, p.department, p.selling_price, c.name, c2.name
        ORDER BY total_revenue DESC
        LIMIT $${idx}
        `,
        values
      );
    
      return result.rows;
    }


    static async getTodaySoldProducts() {
      // "Today" in Kathmandu wall time; sold = completed orders only.
      const { from, to } = todayNPT();
      const startDate = from;
      const endDate = to;
    
      const result = await query(
        `
        SELECT
          p.id,
          p.name,
          p.department,
          p.selling_price,
    
          c.name AS category_name,
    
          SUM(oi.quantity)                    AS total_qty_sold,
    
          ROUND(AVG(oi.unit_price), 2)        AS avg_unit_price,
    
          SUM(oi.total_price)                 AS total_sales,
    
          COUNT(DISTINCT oi.order_id)         AS total_orders
    
        FROM order_items oi
    
        JOIN products p
          ON oi.product_id = p.id
    
        LEFT JOIN categories c
          ON p.category_id = c.id
    
        JOIN orders o
          ON oi.order_id = o.id
    
        WHERE
          o.status = 'completed'
          AND o.order_time >= $1
          AND o.order_time < $2
    
        GROUP BY
          p.id,
          p.name,
          p.department,
          p.selling_price,
          c.name
    
        ORDER BY
          total_qty_sold DESC,
          total_sales DESC
        `,
        [startDate, endDate]
      );
    
      return result.rows;
    }
  
    // ─── 6. HOURLY HEATMAP ──────────────────────────────────────────────────
    static async getHourlyHeatmap() {
      const result = await query(`SELECT * FROM v_hourly_heatmap`);
      return result.rows;
    }
  
    // ─── 7. CREDIT AGING ────────────────────────────────────────────────────
    static async getCreditAging() {
      const result = await query(`SELECT * FROM aged_receivables`);
      return result.rows;
    }
  
    // ─── 8. STAFF PERFORMANCE ───────────────────────────────────────────────
    static async getStaffPerformance(from?: string, to?: string) {
      // Raw query params are Kathmandu calendar days; default = today in NPT.
      const range = from && to
        ? { from: nptDayStartUTC(from), to: nptDayEndUTC(to) }
        : todayNPT();
  
      const result = await query(
        `
        SELECT
          u.id,
          u.full_name,
          COUNT(DISTINCT o.id)                                                    AS orders_handled,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'completed')             AS completed,
          COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled')             AS cancelled,
          COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'completed'), 0) AS revenue_generated,
          ROUND(AVG(o.total_amount)   FILTER (WHERE o.status = 'completed'), 2)  AS avg_order_value,
          ROUND(
            COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled') * 100.0
            / NULLIF(COUNT(DISTINCT o.id), 0),
          2)                                                                      AS cancellation_rate_pct
        FROM users u
        LEFT JOIN orders o ON o.created_by = u.id
          AND o.order_time BETWEEN $1 AND $2
        GROUP BY u.id, u.full_name
        ORDER BY revenue_generated DESC
        `,
        [range.from, range.to]
      );
  
      return result.rows;
    }
  
    // ─── 9. RECENT ORDERS ───────────────────────────────────────────────────
    static async getRecentOrders(limit = 20) {
      const result = await query(
        `
        SELECT
          o.id,
          o.order_number,
          o.order_type,
          o.status,
          o.payment_status,
          o.total_amount::numeric        AS total_amount,
          o.paid_amount::numeric         AS paid_amount,
          o.balance_amount::numeric      AS balance_amount,
          o.order_time,
          t.table_number,
          u.full_name                    AS created_by_name,
          cc.customer_name               AS credit_customer_name,
          COUNT(oi.id)::int              AS item_count
        FROM orders o
        LEFT JOIN tables           t  ON o.table_id           = t.id
        LEFT JOIN users            u  ON o.created_by         = u.id
        LEFT JOIN credit_customers cc ON o.credit_customer_id = cc.id
        LEFT JOIN order_items      oi ON o.id                 = oi.order_id
        WHERE o.order_time >= (NOW() AT TIME ZONE 'Asia/Kathmandu')::date 
                       AT TIME ZONE 'Asia/Kathmandu'
        GROUP BY o.id, t.table_number, u.full_name, cc.customer_name
        ORDER BY o.order_time DESC
        LIMIT $1
        `,
        [limit]
      );
    
      return result.rows.map((o) => ({
        id:           o.id,
        order_number: o.order_number,
        order_type:   o.order_type,
        status:       o.status,
        order_time:   o.order_time,
        item_count:   o.item_count,
    
        // Table only relevant for dine-in
        table_number: o.order_type === 'dine_in' ? o.table_number : null,
    
        // Customer identity
        served_by:    o.created_by_name,
        customer:     o.credit_customer_name ?? null,
    
        // Financial — shaped by what still needs action
        financials: {
          total:      Number(o.total_amount),
          paid:       Number(o.paid_amount),
          balance:    Number(o.balance_amount),
          is_settled: o.payment_status === 'paid',
        },
      }));
    }
  
    // ─── 10. DISCOUNT ANALYSIS ──────────────────────────────────────────────
    static async getDiscountAnalysis(from?: string, to?: string) {
      const range = from && to
        ? { from: nptDayStartUTC(from), to: nptDayEndUTC(to) }
        : lastNNPTDays(30);
  
      const result = await query(
        `
        SELECT
          discount_type,
          COUNT(*)                       AS order_count,
          SUM(discount_amount)           AS total_discount_given,
          ROUND(AVG(discount_amount), 2) AS avg_discount,
          SUM(subtotal - discount_amount) AS revenue_after_discount,
          SUM(subtotal)                  AS gross_revenue,
          ROUND(
            SUM(discount_amount) * 100.0
            / NULLIF(SUM(subtotal), 0),
          2)                             AS effective_discount_rate_pct
        FROM orders
        WHERE status = 'completed'
          AND discount_type IS NOT NULL
          AND order_time BETWEEN $1 AND $2
        GROUP BY discount_type
        ORDER BY total_discount_given DESC
        `,
        [range.from, range.to]
      );
  
      return result.rows;
    }
  
    // ─── 11. CANCELLATION ANALYSIS ──────────────────────────────────────────
    static async getCancellationAnalysis(from?: string, to?: string) {
      const range = from && to
        ? { from: nptDayStartUTC(from), to: nptDayEndUTC(to) }
        : lastNNPTDays(30);
  
      const result = await query(
        `
        SELECT
          cancellation_reason,
          order_type,
          COUNT(*)          AS count,
          SUM(total_amount) AS lost_revenue
        FROM orders
        WHERE status = 'cancelled'
          AND cancelled_at BETWEEN $1 AND $2
        GROUP BY cancellation_reason, order_type
        ORDER BY count DESC
        `,
        [range.from, range.to]
      );
  
      return result.rows;
    }
  }