export const calculatePagination = (page: number = 1, limit: number = 10) => {
  const offset = (page - 1) * limit;
  return { offset, limit };
};

export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number
) => {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

export const sanitizeQuery = (query: any): any => {
  const sanitized: any = {};
  for (const key in query) {
    if (query[key] !== undefined && query[key] !== null && query[key] !== "") {
      sanitized[key] = query[key];
    }
  }
  return sanitized;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "NPR",
  }).format(amount);
};

export const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `ORD-${timestamp}-${random}`.toUpperCase();
};
