const { Router } = require('express');
const controller = require('../controllers/import.controller');
const schema = require('../validators/import.validator');
const validate = require('../middleware/validate');
const { statementUpload, requireFile } = require('../middleware/upload');

const router = Router();

router.post('/statement/preview', statementUpload, requireFile('statement'), controller.preview);
router.post('/statement/commit', validate(schema.commit), controller.commit);

module.exports = router;
