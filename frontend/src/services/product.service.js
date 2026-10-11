import api, { unwrap, unwrapWithMeta, cleanParams } from './api';

export const productService = {
  list: (params) => unwrapWithMeta(api.get('/products', { params: cleanParams(params) })),
  detail: (key) => unwrap(api.get('/products/detail', { params: { key } })),
};
