const { Router } = require('express');
const controller = require('../controllers/maaser.controller');
const schema = require('../validators/maaser.validator');
const { periodQuery } = require('../validators/common.validator');
const validate = require('../middleware/validate');

const router = Router();

router.get('/', validate(periodQuery, 'query'), controller.overview);
router.put('/settings', validate(schema.settings), controller.updateSettings);
router.post('/donations', validate(schema.donation), controller.addDonation);

module.exports = router;
