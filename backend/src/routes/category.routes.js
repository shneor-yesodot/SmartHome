const { Router } = require('express');
const controller = require('../controllers/category.controller');
const schema = require('../validators/category.validator');
const { idParam } = require('../validators/common.validator');
const validate = require('../middleware/validate');

const router = Router();

router.route('/').get(validate(schema.listQuery, 'query'), controller.list).post(validate(schema.create), controller.create);

router
  .route('/:id')
  .put(validate(idParam, 'params'), validate(schema.update), controller.update)
  .delete(validate(idParam, 'params'), controller.remove);

module.exports = router;
