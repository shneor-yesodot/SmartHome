const productManager = require('../managers/product.manager');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

const list = asyncHandler(async (req, res) => {
  const { products, stats } = await productManager.list(req.user.id, req.query);
  ok(res, products, { stats });
});
const detail = asyncHandler(async (req, res) => ok(res, await productManager.detail(req.user.id, req.query.key)));

module.exports = { list, detail };
