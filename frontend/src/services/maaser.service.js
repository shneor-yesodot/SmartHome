import api, { unwrap } from './api';

export const maaserService = {
  /** Target, given and carried-over balance of a month: { calendar, date } (default: this month) */
  overview: (params) => unwrap(api.get('/maaser', { params })),
  updateSettings: (data) => unwrap(api.put('/maaser/settings', data)),
  /** { recipient, amount, date, notes } - saved as an expense in the maaser category */
  addDonation: (data) => unwrap(api.post('/maaser/donations', data)),
};
