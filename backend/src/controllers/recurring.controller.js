const recurringManager = require('../managers/recurring.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/response');

const list = asyncHandler(async (req, res) => ok(res, await recurringManager.list(req.user.id)));
const create = asyncHandler(async (req, res) => created(res, await recurringManager.create(req.user.id, req.body)));
const update = asyncHandler(async (req, res) =>
  ok(res, await recurringManager.update(req.user.id, req.params.id, req.body))
);
const remove = asyncHandler(async (req, res) => {
  await recurringManager.remove(req.user.id, req.params.id);
  noContent(res);
});
const runNow = asyncHandler(async (req, res) => created(res, await recurringManager.runNow(req.user.id, req.params.id)));

module.exports = { list, create, update, remove, runNow };
