import Joi from 'joi';

const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export const salesSummarySchema = {
  query: Joi.object({
    mode: Joi.string()
      .valid('daily', 'weekly', 'monthly', 'yearly')
      .default('weekly'),

    from: Joi.date().iso().optional(),
    to:   Joi.date().iso().min(Joi.ref('from')).optional(),
  })
  // Both from+to must appear together, or neither
  .and('from', 'to'),
};

export const salesChartSchema = {
  query: Joi.object({
    period: Joi.string().valid(...PERIODS).default('daily'),
    from:   Joi.date().iso().optional(),
    to:     Joi.date().iso().min(Joi.ref('from')).optional(),
  }),
};

export const foodDrinkSalesSchema = {
  query: Joi.object({
    mode: Joi.string()
      .valid('daily', 'weekly', 'monthly', 'yearly', 'custom')
      .default('weekly'),

    from: Joi.date().iso().optional(),
    to:   Joi.date().iso().min(Joi.ref('from')).optional(),
  })
  // Both from+to must appear together, or neither
  .and('from', 'to'),
};

export const topProductsSchema = {
  query: Joi.object({
    mode:        Joi.string()
                   .valid('daily', 'weekly', 'monthly', 'yearly')
                   .default('weekly'),
    from:        Joi.date().iso().optional(),
    to:          Joi.date().iso().min(Joi.ref('from')).optional(),
    limit:       Joi.number().integer().min(1).max(50).default(10),
    category_id: Joi.string().uuid().optional(),
  })
  .and('from', 'to'),
};

export const staffPerformanceSchema = {
  query: Joi.object({
    from: Joi.date().iso().optional(),
    to:   Joi.date().iso().min(Joi.ref('from')).optional(),
  }),
};