const { Router } = require('express');
const controller = require('../controllers/report.controller');
const { periodQuery, periodsQuery } = require('../validators/common.validator');
const validate = require('../middleware/validate');

const router = Router();

router.get('/monthly', validate(periodQuery, 'query'), controller.monthly);
router.get('/periods', validate(periodsQuery, 'query'), controller.periods);

module.exports = router;
