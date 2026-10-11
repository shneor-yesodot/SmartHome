const transactionManager = require('../managers/transaction.manager');
const excelService = require('../services/excel.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/response');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const sendWorkbook = (res, buffer, fileName) => {
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
};

const list = asyncHandler(async (req, res) => {
  const { items, pagination, totals } = await transactionManager.list(req.user.id, req.query);
  ok(res, items, { pagination, totals });
});

const getById = asyncHandler(async (req, res) => ok(res, await transactionManager.getById(req.user.id, req.params.id)));
const create = asyncHandler(async (req, res) => created(res, await transactionManager.create(req.user.id, req.body)));
const update = asyncHandler(async (req, res) =>
  ok(res, await transactionManager.update(req.user.id, req.params.id, req.body))
);
const remove = asyncHandler(async (req, res) => {
  await transactionManager.remove(req.user.id, req.params.id);
  noContent(res);
});

const exportExcel = asyncHandler(async (req, res) => {
  const buffer = await transactionManager.exportToExcel(req.user.id, req.query);
  sendWorkbook(res, buffer, `smarthome-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
});

const importTemplate = asyncHandler(async (_req, res) =>
  sendWorkbook(res, await excelService.buildTemplateWorkbook(), 'smarthome-import-template.xlsx')
);

const importPreview = asyncHandler(async (req, res) => ok(res, await transactionManager.previewImport(req.user.id, req.file)));

const bulkCreate = asyncHandler(async (req, res) => {
  const transactions = await transactionManager.bulkCreate(req.user.id, req.body.rows, { source: 'import' });
  created(res, { created: transactions.length });
});

module.exports = { list, getById, create, update, remove, exportExcel, importTemplate, importPreview, bulkCreate };
