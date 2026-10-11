import { Home } from 'lucide-react';

export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white">
        <Home className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <p className="text-[17px] font-extrabold">SmartHome</p>
        <p className="text-xs text-ink-muted">ניהול משק בית חכם</p>
      </div>
    </div>
  );
}
