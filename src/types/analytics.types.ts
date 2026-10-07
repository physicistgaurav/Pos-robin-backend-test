export interface SalesAnalytics {
  total_sales: number;
  total_orders: number;
  average_order_value: number;
  period_start: Date;
  period_end: Date;
}

export interface TopMenuItem {
  menu_item_id: number;
  menu_item_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface DailySales {
  date: string;
  total_sales: number;
  order_count: number;
}

export interface CategorySales {
  category: string;
  total_sales: number;
  item_count: number;
}
