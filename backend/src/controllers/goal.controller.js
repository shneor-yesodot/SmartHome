const goalManager = require('../managers/goal.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { goals, month } = await goalManager.list(req.user.id);
  ok(res, goals, { month });
});
const create = asyncHandler(async (req, res) => created(res, await goalManager.create(req.user.id, req.body)));
const update = asyncHandler(async (req, res) => ok(res, await goalManager.update(req.user.id, req.params.id, req.body)));
const remove = asyncHandler(async (req, res) => {
  await goalManager.remove(req.user.id, req.params.id);
  noContent(res);
});
const deposit = asyncHandler(async (req, res) => ok(res, await goalManager.deposit(req.user.id, req.params.id, req.body)));

module.exports = { list, create, update, remove, deposit };
