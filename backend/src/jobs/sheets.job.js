const cron = require('node-cron');
const sheetsManager = require('../managers/sheets.manager');
const googleSheets = require('../services/googleSheets.service');
const logger = require('../utils/logger');

const CATCH_UP_AFTER_MS = 20 * 60 * 60 * 1000;

const run = (options) =>
  sheetsManager
    .syncAll(options)
    .then((r) => logger.info(`[job:sheets] synced ${r.synced} of ${r.users} spreadsheets`))
    .catch((err) => logger.error('[job:sheets]', err.message));

/** Every night at 03:00, and on start-up for backups missed while a free-plan server slept. */
const schedule = () => {
  if (!googleSheets.isConfigured()) return;
  cron.schedule('0 3 * * *', () => run());
  run({ olderThan: new Date(Date.now() - CATCH_UP_AFTER_MS) });
};

module.exports = { schedule };
