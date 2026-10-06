import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

/** Row-Level Security: every query is scoped to the authenticated user. */
export function ownerFilter(req) {
  return { created_by_id: new mongoose.Types.ObjectId(req.userId) };
}

export function assertOwnId(req) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'מזהה לא תקין');
  }
  return id;
}

export function stampOwner(req, payload) {
  return { ...payload, created_by_id: req.userId };
}
