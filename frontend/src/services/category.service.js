import api, { unwrap } from './api';

export const categoryService = {
  list: () => unwrap(api.get('/categories')),
  create: (data) => unwrap(api.post('/categories', data)),
  update: (id, data) => unwrap(api.put(`/categories/${id}`, data)),
  remove: (id) => api.delete(`/categories/${id}`),
  /** Reads the category columns of a summary sheet. Saves nothing. */
  previewImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap(api.post('/categories/import/preview', form));
  },
  importNames: (names) => unwrap(api.post('/categories/import/commit', names)),
};
