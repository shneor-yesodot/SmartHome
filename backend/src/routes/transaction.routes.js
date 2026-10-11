const { Router } = require('express');
const controller = require('../controllers/transaction.controller');
const schema = require('../validators/transaction.validator');
const { idParam } = require('../validators/common.validator');
const validate = require('../middleware/validate');
const { sheetUpload, requireFile } = require('../middleware/upload');

const router = Router();

// Excel - defined before "/:id" so the fixed paths are matched first
router.get('/export', validate(schema.listQuery, 'query'), controller.exportExcel);
router.get('/import/template', controller.importTemplate);
router.post('/import/preview', sheetUpload, requireFile('sheet'), controller.importPreview);
router.post('/bulk', validate(schema.bulkCreate), controller.bulkCreate);

router.route('/').get(validate(schema.listQuery, 'query'), controller.list).post(validate(schema.create), controller.create);

router
  .route('/:id')
  .all(validate(idParam, 'params'))
  .get(controller.getById)
  .put(validate(schema.update), controller.update)
  .delete(controller.remove);

module.exports = router;
