const { Router } = require('express');
const controller = require('../controllers/account.controller');
const schema = require('../validators/account.validator');
const { idParam, periodQuery } = require('../validators/common.validator');
const validate = require('../middleware/validate');

const router = Router();

router.get('/overview', validate(periodQuery, 'query'), controller.overview);
router.route('/').get(controller.list).post(validate(schema.create), controller.create);
router.get('/:id/charges', validate(idParam, 'params'), controller.charges);
router
  .route('/:id')
  .all(validate(idParam, 'params'))
  .put(validate(schema.update), controller.update)
  .delete(controller.remove);

module.exports = router;
