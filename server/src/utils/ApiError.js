export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      status: 'error',
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: Object.values(err.errors || {}).map((e) => ({
          field: e.path,
          message: e.message,
        })),
      },
    });
  }

  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'הקובץ גדול מדי (עד 10MB)' : 'העלאת הקובץ נכשלה';
    return res.status(400).json({ status: 'error', error: { code: 'VALIDATION_ERROR', message } });
  }

  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(err.status).json({
      status: 'error',
      error: { code: 'BAD_REQUEST', message: 'גוף הבקשה אינו תקין' },
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      status: 'error',
      error: { code: 'DUPLICATE', message: 'רשומה כפולה' },
    });
  }

  console.error(err);
  return res.status(500).json({
    status: 'error',
    error: { code: 'SERVER_ERROR', message: 'שגיאת שרת' },
  });
}
