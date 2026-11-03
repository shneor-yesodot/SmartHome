const maaserManager = require('../managers/maaser.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const { resolvePeriod } = require('../utils/period');

const overview = asyncHandler(async (req, res) => {
  ok(res, await maaserManager.overview(req.user, resolvePeriod(req.query, req.user.calendar)));
});

const updateSettings = asyncHandler(async (req, res) => ok(res, await maaserManager.updateSettings(req.user.id, req.body)));

const addDonation = asyncHandler(async (req, res) => created(res, await maaserManager.addDonation(req.user.id, req.body)));

module.exports = { overview, updateSettings, addDonation };
