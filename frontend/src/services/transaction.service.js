import api, { unwrap, unwrapWithMeta, cleanParams } from './api';

export const transactionService = {
  list: (params) => unwrapWithMeta(api.get('/transactions', { params: cleanParams(params) })),
  create: (data) => unwrap(api.post('/transactions', data)),
  update: (id, data) => unwrap(api.put(`/transactions/${id}`, data)),
  remove: (id) => api.delete(`/transactions/${id}`),

  exportExcel: (params) =>
    api.get('/transactions/export', { params: cleanParams(params), responseType: 'blob' }).then((res) => res.data),
  downloadTemplate: () => api.get('/transactions/import/template', { responseType: 'blob' }).then((res) => res.data),
  previewImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap(api.post('/transactions/import/preview', form));
  },
  bulkCreate: (rows) => unwrap(api.post('/transactions/bulk', { rows })),
  /** One purchase with several products: { merchant, date, notes?, items: [{ name, quantity, total, category }] } */
  createBasket: (data) => unwrap(api.post('/transactions/basket', data)),
};
