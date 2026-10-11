import api, { unwrap } from './api';

export const budgetService = {
  list: () => unwrap(api.get('/budgets')),
  create: (data) => unwrap(api.post('/budgets', data)),
  update: (id, data) => unwrap(api.put(`/budgets/${id}`, data)),
  remove: (id) => api.delete(`/budgets/${id}`),
};
