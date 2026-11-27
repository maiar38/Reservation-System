import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  MONGODB_URI: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.number().default(900),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.number().default(604800),
  APP_TIMEZONE: Joi.string()
    .default('UTC')
    .custom((value: string) => {
      // Throws for an unknown timezone, e.g. "Cairo" instead of "Africa/Cairo"
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return value;
    }),
  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().min(8).optional(),
});
