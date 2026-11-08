import api, { unwrap, unwrapWithMeta } from './api';

export const goalService = {
  /** { data: goals, meta: { month } } - month is this month's savings plan */
  list: () => unwrapWithMeta(api.get('/goals')),
  create: (data) => unwrap(api.post('/goals', data)),
  update: (id, data) => unwrap(api.put(`/goals/${id}`, data)),
  remove: (id) => api.delete(`/goals/${id}`),
  deposit: (id, data) => unwrap(api.post(`/goals/${id}/deposit`, data)),
};
