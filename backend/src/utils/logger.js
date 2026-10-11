/** Minimal levelled logger (keeps the project free of heavy logging dependencies). */
const stamp = () => new Date().toISOString();
const silent = process.env.NODE_ENV === 'test';

const log = (level, method) => (...args) => {
  if (silent) return;
  console[method](`[${stamp()}] ${level}`, ...args);
};

module.exports = {
  info: log('INFO ', 'log'),
  warn: log('WARN ', 'warn'),
  error: log('ERROR', 'error'),
};
