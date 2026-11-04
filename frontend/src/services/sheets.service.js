import api, { unwrap } from './api';

export const sheetsService = {
  status: () => unwrap(api.get('/sheets')),
  connect: (data) => unwrap(api.post('/sheets/connect', data)),
  update: (data) => unwrap(api.patch('/sheets', data)),
  disconnect: () => unwrap(api.delete('/sheets')),
  preview: () => unwrap(api.get('/sheets/preview')),
  sync: () => unwrap(api.post('/sheets/sync')),
};
