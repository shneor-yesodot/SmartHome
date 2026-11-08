import api, { unwrap } from './api';

export const reportService = {
  /** { calendar: 'gregorian' | 'hebrew', date: any day of the month (default: this month) } */
  monthly: (params) => unwrap(api.get('/reports/monthly', { params })),
  /** The last months in the user's calendar, newest first: [{ label, start, end }] */
  periods: (params) => unwrap(api.get('/reports/periods', { params })),
};
