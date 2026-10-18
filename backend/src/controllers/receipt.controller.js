const receiptManager = require('../managers/receipt.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { items, pagination } = await receiptManager.list(req.user.id, req.query);
  ok(res, items, { pagination });
});
const scan = asyncHandler(async (req, res) => created(res, await receiptManager.scan(req.user.id, req.file)));
const confirm = asyncHandler(async (req, res) =>
  created(res, await receiptManager.confirm(req.user.id, req.params.id, req.body))
);
const remove = asyncHandler(async (req, res) => {
  await receiptManager.remove(req.user.id, req.params.id);
  noContent(res);
});
const file = asyncHandler(async (req, res) => {
  const { path, mimeType } = await receiptManager.getFile(req.user.id, req.params.id);
  res.type(mimeType).sendFile(path);
});

module.exports = { list, scan, confirm, remove, file };
