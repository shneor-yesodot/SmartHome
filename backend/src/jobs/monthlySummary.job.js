const cron = require('node-cron');
const userRepository = require('../repositories/user.repository');
const reportManager = require('../managers/report.manager');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');
const { currentMonth, shiftMonth } = require('../utils/dateUtils');

/** E-mails every subscribed user a summary of the month that just ended. */
const run = async () => {
  const { year, month } = currentMonth();
  const previous = shiftMonth(year, month, -1);
  const users = await userRepository.findForMonthlySummary();

  let sent = 0;
  for (const user of users) {
    const report = await reportManager.monthly(user.id, previous);
    if (report.transactionsCount === 0) continue;
    await emailService.sendMonthlySummary(user, report);
    sent += 1;
  }
  logger.info(`[job:monthly-summary] sent ${sent} e-mails`);
  return { sent };
};

/** On the 1st of every month at 08:00. */
const schedule = () => {
  cron.schedule('0 8 1 * *', () => run().catch((err) => logger.error('[job:monthly-summary]', err.message)));
};

module.exports = { schedule, run };
