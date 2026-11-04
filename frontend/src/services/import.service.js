import api, { unwrap } from './api';

export const importService = {
  /** Reads a bank or card statement and says what would happen to each line. Saves nothing. */
  preview: (file) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap(api.post('/imports/statement/preview', form));
  },
  commit: (rows, account) => unwrap(api.post('/imports/statement/commit', { rows, account: account || null })),
};
