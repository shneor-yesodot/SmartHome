const { Router } = require('express');
const controller = require('../controllers/recurring.controller');
const schema = require('../validators/recurring.validator');
const { idParam } = require('../validators/common.validator');
const validate = require('../middleware/validate');

const router = Router();

router.route('/').get(controller.list).post(validate(schema.create), controller.create);
router.post('/:id/run', validate(idParam, 'params'), validate(schema.run), controller.runNow);

router
  .route('/:id')
  .all(validate(idParam, 'params'))
  .put(validate(schema.update), controller.update)
  .delete(controller.remove);

module.exports = router;
