const reportManager = require('../managers/report.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { resolvePeriod } = require('../utils/period');

const monthly = asyncHandler(async (req, res) => {
  ok(res, await reportManager.monthly(req.user.id, resolvePeriod(req.query, req.user.calendar)));
});

const periods = asyncHandler(async (req, res) => {
  ok(res, reportManager.periods({ calendar: req.query.calendar || req.user.calendar, count: req.query.count }));
});

module.exports = { monthly, periods };
