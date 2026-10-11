const reportManager = require('../managers/report.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { currentMonth } = require('../utils/dateUtils');

const monthly = asyncHandler(async (req, res) => {
  const period = req.query.year !== undefined ? req.query : currentMonth();
  ok(res, await reportManager.monthly(req.user.id, period));
});

module.exports = { monthly };
