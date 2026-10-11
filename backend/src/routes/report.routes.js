const { Router } = require('express');
const controller = require('../controllers/report.controller');
const { monthQuery } = require('../validators/common.validator');
const validate = require('../middleware/validate');

const router = Router();

router.get('/monthly', validate(monthQuery, 'query'), controller.monthly);

module.exports = router;
