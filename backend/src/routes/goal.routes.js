const { Router } = require('express');
const controller = require('../controllers/goal.controller');
const schema = require('../validators/goal.validator');
const { idParam } = require('../validators/common.validator');
const validate = require('../middleware/validate');

const router = Router();

router.route('/').get(controller.list).post(validate(schema.create), controller.create);
router.post('/:id/deposit', validate(idParam, 'params'), validate(schema.deposit), controller.deposit);

router
  .route('/:id')
  .all(validate(idParam, 'params'))
  .put(validate(schema.update), controller.update)
  .delete(controller.remove);

module.exports = router;
