import api, { unwrap, unwrapWithMeta } from './api';

export const receiptService = {
  /** { data: receipts, meta: { pagination } } - newest first */
  list: (params) => unwrapWithMeta(api.get('/receipts', { params })),
  scan: (file) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap(api.post('/receipts/scan', form));
  },
  confirm: (id, data) => unwrap(api.post(`/receipts/${id}/confirm`, data)),
  remove: (id) => api.delete(`/receipts/${id}`),
  /** The original file. Fetched through the API (it needs the access token), shown via an object URL. */
  file: (id) => api.get(`/receipts/${id}/file`, { responseType: 'blob' }).then((res) => res.data),
};
