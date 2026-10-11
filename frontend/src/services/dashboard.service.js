import api, { unwrap } from './api';

export const dashboardService = {
  overview: () => unwrap(api.get('/dashboard')),
  insights: () => unwrap(api.post('/dashboard/insights')),
};
