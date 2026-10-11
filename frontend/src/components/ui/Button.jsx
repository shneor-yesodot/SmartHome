import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const VARIANTS = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' };

export default function Button({ variant = 'primary', size = 'md', icon: Icon, loading = false, className, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={clsx('btn', VARIANTS[variant], size === 'sm' && 'btn-sm', className)}
      disabled={loading || props.disabled}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
