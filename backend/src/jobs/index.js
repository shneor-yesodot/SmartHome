const recurringJob = require('./recurring.job');
const monthlySummaryJob = require('./monthlySummary.job');
const sheetsJob = require('./sheets.job');
const logger = require('../utils/logger');

const startJobs = () => {
  recurringJob.schedule();
  monthlySummaryJob.schedule();
  sheetsJob.schedule();
  logger.info('Scheduled jobs started');
};

module.exports = { startJobs };
