const recurringJob = require('./recurring.job');
const monthlySummaryJob = require('./monthlySummary.job');
const logger = require('../utils/logger');

const startJobs = () => {
  recurringJob.schedule();
  monthlySummaryJob.schedule();
  logger.info('Scheduled jobs started');
};

module.exports = { startJobs };
