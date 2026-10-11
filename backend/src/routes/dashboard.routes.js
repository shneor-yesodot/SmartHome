const { Router } = require('express');
const controller = require('../controllers/dashboard.controller');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = Router();

router.get('/', controller.overview);
router.post('/insights', aiLimiter, controller.insights);

module.exports = router;
