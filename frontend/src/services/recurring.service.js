import api, { unwrap } from './api';

export const recurringService = {
  list: () => unwrap(api.get('/recurring')),
  create: (data) => unwrap(api.post('/recurring', data)),
  update: (id, data) => unwrap(api.put(`/recurring/${id}`, data)),
  remove: (id) => api.delete(`/recurring/${id}`),
  /** `nextRun` is the date on screen: if the payment ran meanwhile, the server refuses instead of paying ahead */
  runNow: (id, nextRun) => unwrap(api.post(`/recurring/${id}/run`, { nextRun })),
};
