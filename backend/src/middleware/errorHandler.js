const multer = require('multer');
const env = require('../config/env');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) => next(ApiError.notFound(`הנתיב ${req.method} ${req.originalUrl} אינו קיים`));

/** Converts known library errors into clean client errors. */
const normalize = (err) => {
  if (err instanceof ApiError) return err;
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message }));
    return new ApiError(400, 'הנתונים שנשלחו אינם תקינים', details);
  }
  if (err.name === 'CastError') return new ApiError(400, 'מזהה לא תקין');
  if (err.code === 11000) return new ApiError(409, 'כבר קיים פריט עם אותם פרטים');
  if (err instanceof multer.MulterError) {
    return new ApiError(400, err.code === 'LIMIT_FILE_SIZE' ? `הקובץ גדול מדי (עד ${env.maxFileSizeMb}MB)` : 'העלאת הקובץ נכשלה');
  }
  if (err.type === 'entity.parse.failed') return new ApiError(400, 'גוף הבקשה אינו JSON תקין');
  if (err.type === 'entity.too.large') return new ApiError(413, 'הבקשה גדולה מדי');
  return null;
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const known = normalize(err);
  if (!known) logger.error(`${req.method} ${req.originalUrl}`, err);

  // Internal details are never exposed to the client in production
  const status = known ? known.statusCode : 500;
  res.status(status).json({
    success: false,
    message: known ? known.message : 'אירעה שגיאה בשרת. נסו שוב מאוחר יותר',
    ...(known?.details ? { details: known.details } : {}),
    ...(!env.isProd && !known ? { stack: err.stack } : {}),
  });
};

module.exports = { notFound, errorHandler };
