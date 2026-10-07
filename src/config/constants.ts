export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const ERROR_MESSAGES = {
  VALIDATION_ERROR: "Validation failed",
  NOT_FOUND: "Resource not found",
  INTERNAL_ERROR: "Internal server error",
  DATABASE_ERROR: "Database operation failed",
  DUPLICATE_ENTRY: "Resource already exists",
  INVALID_STATUS: "Invalid status transition",
} as const;

export const SUCCESS_MESSAGES = {
  CREATED: "Resource created successfully",
  UPDATED: "Resource updated successfully",
  DELETED: "Resource deleted successfully",
  FETCHED: "Resource fetched successfully",
} as const;

export const ORDER_STATUS = {
  PENDING : 'pending',
  CONFIRMED : 'confirmed',
  PREPARING : 'preparing',
  READY : 'ready',
  SERVED : 'served',
  COMPLETED : 'completed',
  CANCELLED : 'cancelled'
} as const;

export const TABLE_STATUS = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  RESERVED: "reserved",
  CLEANING: "cleaning",
  OUT_OF_SERVICE: "out_of_service",
} as const;

export const MENU_CATEGORY = {
  APPETIZER: "appetizer",
  MAIN_COURSE: "main_course",
  DESSERT: "dessert",
  BEVERAGE: "beverage",
  SIDE_DISH: "side_dish",
} as const;
