const dashboardManager = require('../managers/dashboard.manager');
const insightManager = require('../managers/insight.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

const overview = asyncHandler(async (req, res) => ok(res, await dashboardManager.overview(req.user.id, { calendar: req.user.calendar })));
const insights = asyncHandler(async (req, res) => ok(res, await insightManager.generate(req.user.id, req.user.calendar)));

module.exports = { overview, insights };
