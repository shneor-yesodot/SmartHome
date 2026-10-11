/** Operational error that is safe to show to the client. */
class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'נדרשת התחברות למערכת') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'אין הרשאה לבצע פעולה זו') {
    return new ApiError(403, message);
  }
  static notFound(message = 'הפריט המבוקש לא נמצא') {
    return new ApiError(404, message);
  }
  static conflict(message) {
    return new ApiError(409, message);
  }
}

module.exports = ApiError;
