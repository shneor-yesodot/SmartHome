const importManager = require('../managers/import.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

const preview = asyncHandler(async (req, res) => ok(res, await importManager.preview(req.user.id, req.file)));
const commit = asyncHandler(async (req, res) => created(res, await importManager.commit(req.user.id, req.body)));

module.exports = { preview, commit };
