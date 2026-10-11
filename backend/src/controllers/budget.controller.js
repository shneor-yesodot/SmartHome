const budgetManager = require('../managers/budget.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/response');

const list = asyncHandler(async (req, res) => ok(res, await budgetManager.list(req.user.id, req.query)));
const create = asyncHandler(async (req, res) => created(res, await budgetManager.create(req.user.id, req.body)));
const update = asyncHandler(async (req, res) => ok(res, await budgetManager.update(req.user.id, req.params.id, req.body)));
const remove = asyncHandler(async (req, res) => {
  await budgetManager.remove(req.user.id, req.params.id);
  noContent(res);
});

module.exports = { list, create, update, remove };
