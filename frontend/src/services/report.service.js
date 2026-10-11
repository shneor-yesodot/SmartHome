import api, { unwrap } from './api';

export const reportService = {
  monthly: (year, month) => unwrap(api.get('/reports/monthly', { params: { year, month } })),
};
