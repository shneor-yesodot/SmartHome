import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccess } from '../utils/tokens.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'טוקן חסר');

    let payload;
    try {
      payload = verifyAccess(token);
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'טוקן פגוע או פג תוקף');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'משתמש לא נמצא');
    if (!user.emailVerified) throw new ApiError(403, 'FORBIDDEN', 'האימייל טרם אומת');

    req.user = user;
    req.userId = String(user._id);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'FORBIDDEN', 'אין הרשאת מנהל'));
  }
  next();
}
