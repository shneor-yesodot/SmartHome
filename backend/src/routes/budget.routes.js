const { Router } = require('express');
const controller = require('../controllers/budget.controller');
const schema = require('../validators/budget.validator');
const { idParam, monthQuery } = require('../validators/common.validator');
const validate = require('../middleware/validate');

const router = Router();

router.route('/').get(validate(monthQuery, 'query'), controller.list).post(validate(schema.create), controller.create);

router
  .route('/:id')
  .all(validate(idParam, 'params'))
  .put(validate(schema.update), controller.update)
  .delete(controller.remove);

module.exports = router;
