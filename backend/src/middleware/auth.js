const tokenService = require('../services/token.service');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/** Requires a valid "Authorization: Bearer <token>" header and loads the user. */
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = tokenService.verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('פג תוקף ההתחברות. יש להתחבר מחדש');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('החשבון אינו קיים עוד');

  req.user = user;
  next();
});

/** Role-based access control, e.g. authorize('admin'). */
const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(ApiError.forbidden());

module.exports = { authenticate, authorize };
