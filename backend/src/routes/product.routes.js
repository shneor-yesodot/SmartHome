const { Router } = require('express');
const controller = require('../controllers/product.controller');
const schema = require('../validators/product.validator');
const validate = require('../middleware/validate');

const router = Router();

router.get('/', validate(schema.listQuery, 'query'), controller.list);
router.get('/detail', validate(schema.detailQuery, 'query'), controller.detail);

module.exports = router;
