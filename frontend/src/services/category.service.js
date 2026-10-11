import api, { unwrap } from './api';

export const categoryService = {
  list: () => unwrap(api.get('/categories')),
  create: (data) => unwrap(api.post('/categories', data)),
  update: (id, data) => unwrap(api.put(`/categories/${id}`, data)),
  remove: (id) => api.delete(`/categories/${id}`),
};
