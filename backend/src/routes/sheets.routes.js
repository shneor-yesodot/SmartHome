const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/sheets.controller');
const validate = require('../middleware/validate');
const { SHEET_SYNC_MODES } = require('../config/constants');

const router = Router();

const mode = Joi.string().valid(...SHEET_SYNC_MODES);
const connectSchema = Joi.object({ spreadsheet: Joi.string().trim().max(300).required().label('קישור לגיליון'), mode, autoSync: Joi.boolean() });
const updateSchema = Joi.object({ mode, autoSync: Joi.boolean() }).min(1);

router.get('/', controller.status);
router.post('/connect', validate(connectSchema), controller.connect);
router.patch('/', validate(updateSchema), controller.update);
router.delete('/', controller.disconnect);
router.get('/preview', controller.preview);
router.post('/sync', controller.sync);

module.exports = router;
