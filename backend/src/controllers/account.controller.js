const accountManager = require('../managers/account.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/response');
const { resolvePeriod } = require('../utils/period');

/** "" and null clear a field: Mongoose would refuse an empty last4. */
const clean = ({ last4, ...data }) => ({ ...data, ...(last4 ? { last4 } : {}) });

const list = asyncHandler(async (req, res) => ok(res, await accountManager.list(req.user.id)));
const overview = asyncHandler(async (req, res) => ok(res, await accountManager.overview(req.user.id, resolvePeriod(req.query, req.user.calendar))));
const charges = asyncHandler(async (req, res) => ok(res, await accountManager.charges(req.user.id, req.params.id)));
const create = asyncHandler(async (req, res) => created(res, await accountManager.create(req.user.id, clean(req.body))));
const update = asyncHandler(async (req, res) => ok(res, await accountManager.update(req.user.id, req.params.id, clean(req.body))));
const remove = asyncHandler(async (req, res) => {
  await accountManager.remove(req.user.id, req.params.id);
  noContent(res);
});

module.exports = { list, overview, charges, create, update, remove };
