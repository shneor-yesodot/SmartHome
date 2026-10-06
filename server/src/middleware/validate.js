import { ApiError } from '../utils/ApiError.js';

/**
 * Validates and strips req[property] against a Joi schema.
 * Pass { partial: true } for updates so schema defaults don't overwrite stored fields.
 */
export function validate(schema, { property = 'body', partial = false } = {}) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      noDefaults: partial,
    });
    if (error) {
      return next(
        new ApiError(
          400,
          'VALIDATION_ERROR',
          error.details[0]?.message || 'שגיאת ולידציה',
          error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))
        )
      );
    }
    req[property] = value;
    next();
  };
}
