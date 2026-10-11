const ApiError = require('../utils/ApiError');

// Hebrew versions of the most common Joi messages
const messages = {
  'any.required': 'השדה "{{#label}}" הוא שדה חובה',
  'any.only': 'הערך בשדה "{{#label}}" אינו חוקי',
  'string.base': 'השדה "{{#label}}" חייב להיות טקסט',
  'string.empty': 'השדה "{{#label}}" לא יכול להיות ריק',
  'string.min': 'השדה "{{#label}}" חייב להכיל לפחות {{#limit}} תווים',
  'string.max': 'השדה "{{#label}}" יכול להכיל עד {{#limit}} תווים',
  'string.email': 'כתובת האימייל אינה תקינה',
  'string.hex': 'מזהה לא תקין בשדה "{{#label}}"',
  'string.length': 'מזהה לא תקין בשדה "{{#label}}"',
  'number.base': 'השדה "{{#label}}" חייב להיות מספר',
  'number.positive': 'השדה "{{#label}}" חייב להיות מספר חיובי',
  'number.min': 'הערך בשדה "{{#label}}" נמוך מדי',
  'number.max': 'הערך בשדה "{{#label}}" גבוה מדי',
  'date.base': 'התאריך בשדה "{{#label}}" אינו תקין',
  'date.format': 'התאריך בשדה "{{#label}}" אינו תקין',
  'array.min': 'יש לשלוח לפחות פריט אחד בשדה "{{#label}}"',
  'object.min': 'לא נשלחו נתונים לעדכון',
};

/**
 * Validates one part of the request against a Joi schema.
 * Unknown fields are stripped, so only whitelisted data reaches the managers
 * (protects against mass-assignment).
 */
const validate = (schema, property = 'body') => (req, _res, next) => {
  const { value, error } = schema.validate(req[property], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    messages,
    errors: { wrap: { label: false } },
  });

  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return next(new ApiError(400, details[0].message, details));
  }
  req[property] = value;
  next();
};

module.exports = validate;
