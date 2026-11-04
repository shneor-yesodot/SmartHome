const sheetsManager = require('../managers/sheets.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

const status = (req, res) => ok(res, sheetsManager.status(req.user));
const connect = asyncHandler(async (req, res) => ok(res, await sheetsManager.connect(req.user, req.body)));
const update = asyncHandler(async (req, res) => ok(res, await sheetsManager.updateSettings(req.user, req.body)));
const disconnect = asyncHandler(async (req, res) => ok(res, await sheetsManager.disconnect(req.user)));
const preview = asyncHandler(async (req, res) => ok(res, await sheetsManager.preview(req.user)));
const sync = asyncHandler(async (req, res) => ok(res, await sheetsManager.sync(req.user)));

module.exports = { status, connect, update, disconnect, preview, sync };
