import { useCallback, useState } from 'react';
import { useToast } from '../context/ToastContext';

/**
 * Runs an async action (save / delete ...) with a pending flag and toasts.
 * const { run, pending } = useAction();  await run(() => service.save(data), 'נשמר');
 */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (action, successMessage) => {
      setPending(true);
      try {
        const result = await action();
        if (successMessage) toast.success(successMessage);
        return { ok: true, result };
      } catch (error) {
        toast.error(error.message);
        return { ok: false, error };
      } finally {
        setPending(false);
      }
    },
    [toast]
  );

  return { run, pending };
}
