import api, { unwrap } from './api';

export const receiptService = {
  list: () => unwrap(api.get('/receipts')),
  scan: (file) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap(api.post('/receipts/scan', form));
  },
  confirm: (id, data) => unwrap(api.post(`/receipts/${id}/confirm`, data)),
  remove: (id) => api.delete(`/receipts/${id}`),
};
