import { PiggyBank, ScanLine, Target } from 'lucide-react';
import Logo from './Logo';

const HIGHLIGHTS = [
  { icon: ScanLine, text: 'מצלמים קבלה, וכל מוצר נרשם כעסקה' },
  { icon: Target, text: 'תקציב לכל קטגוריה והתראה לפני חריגה' },
  { icon: PiggyBank, text: 'יעדי חיסכון עם מעקב אחר הקצב' },
];

/** Two-column frame for the login and register screens. */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,44%)]">
      <main className="flex items-center justify-center bg-white px-5 py-10">
        <div className="w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>

      <aside className="hidden flex-col justify-center bg-brand-500 px-14 text-white lg:flex">
        <p className="max-w-md text-[34px] font-extrabold leading-tight">כל הכסף של הבית, במסך אחד ברור.</p>
        <ul className="mt-10 space-y-5">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-4 text-[17px]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Icon className="h-5 w-5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
