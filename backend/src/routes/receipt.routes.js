const { Router } = require('express');
const controller = require('../controllers/receipt.controller');
const schema = require('../validators/receipt.validator');
const { idParam } = require('../validators/common.validator');
const validate = require('../middleware/validate');
const { receiptUpload, requireFile } = require('../middleware/upload');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = Router();

router.get('/', controller.list);
router.post('/scan', aiLimiter, receiptUpload, requireFile('receipt'), controller.scan);
router.post('/:id/confirm', validate(idParam, 'params'), validate(schema.confirm), controller.confirm);
router.get('/:id/file', validate(idParam, 'params'), controller.file);
router.delete('/:id', validate(idParam, 'params'), controller.remove);

module.exports = router;
