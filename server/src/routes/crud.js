import express from 'express';
import { ownerFilter, assertOwnId, stampOwner } from '../middleware/rls.js';
import { ApiError } from '../utils/ApiError.js';
import { serialize, serializeMany, parseSort } from '../utils/serialize.js';

export function crudRouter(Model, { afterCreate, afterUpdate } = {}) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 200, 1000);
      const sort = parseSort(req.query.sort);
      const docs = await Model.find(ownerFilter(req)).sort(sort).limit(limit);
      res.json({ status: 'success', data: serializeMany(docs) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const id = assertOwnId(req);
      const doc = await Model.findOne({ _id: id, ...ownerFilter(req) });
      if (!doc) throw new ApiError(404, 'NOT_FOUND', 'לא נמצא');
      res.json({ status: 'success', data: serialize(doc) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const payload = stampOwner(req, req.body);
      const doc = await Model.create(payload);
      if (afterCreate) await afterCreate(req, doc);
      res.status(201).json({ status: 'success', data: serialize(doc) });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const id = assertOwnId(req);
      const doc = await Model.findOneAndUpdate(
        { _id: id, ...ownerFilter(req) },
        { $set: req.body },
        { new: true, runValidators: true }
      );
      if (!doc) throw new ApiError(403, 'FORBIDDEN', 'אין הרשאה לעדכן רשומה זו');
      if (afterUpdate) await afterUpdate(req, doc);
      res.json({ status: 'success', data: serialize(doc) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = assertOwnId(req);
      const doc = await Model.findOneAndDelete({ _id: id, ...ownerFilter(req) });
      if (!doc) throw new ApiError(403, 'FORBIDDEN', 'אין הרשאה למחוק רשומה זו');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
