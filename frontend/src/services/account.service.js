import api, { unwrap, cleanParams } from './api';

export const accountService = {
  list: () => unwrap(api.get('/accounts')),
  overview: (params) => unwrap(api.get('/accounts/overview', { params: cleanParams(params) })),
  charges: (id) => unwrap(api.get(`/accounts/${id}/charges`)),
  create: (data) => unwrap(api.post('/accounts', data)),
  update: (id, data) => unwrap(api.put(`/accounts/${id}`, data)),
  remove: (id) => api.delete(`/accounts/${id}`),
};
