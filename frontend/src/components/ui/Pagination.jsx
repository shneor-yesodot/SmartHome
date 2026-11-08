import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, total, unit = 'עסקאות', onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm" aria-label="דפדוף">
      <span className="text-ink-muted">
        עמוד {page} מתוך {pages} ({total} {unit})
      </span>
      <div className="flex gap-1">
        {/* In RTL the "previous" arrow points right */}
        <button className="icon-btn disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="העמוד הקודם">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button className="icon-btn disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="העמוד הבא">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}
