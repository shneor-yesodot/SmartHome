const cron = require('node-cron');
const recurringManager = require('../managers/recurring.manager');
const logger = require('../utils/logger');

const run = async () => {
  const result = await recurringManager.processDue();
  if (result.created) logger.info(`[job:recurring] created ${result.created} transactions from ${result.processed} payments`);
  return result;
};

/** Every day at 00:10 (and once on start-up, to catch up after downtime). */
const schedule = () => {
  cron.schedule('10 0 * * *', () => run().catch((err) => logger.error('[job:recurring]', err.message)));
  run().catch((err) => logger.error('[job:recurring]', err.message));
};

module.exports = { schedule, run };
