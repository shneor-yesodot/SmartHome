import clsx from 'clsx';
import { Check } from 'lucide-react';
import { COLORS } from '../../constants/options';
import { ICON_NAMES, getIcon } from '../../constants/icons';

export function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="צבע">
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          {value === color && <Check className="h-4 w-4" />}
        </button>
      ))}
    </div>
  );
}

export function IconPicker({ value, onChange, color = '#12A05C' }) {
  return (
    <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto" role="radiogroup" aria-label="אייקון">
      {ICON_NAMES.map((name) => {
        const Icon = getIcon(name);
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            onClick={() => onChange(name)}
            className={clsx('flex h-9 w-9 items-center justify-center rounded-lg border', selected ? 'border-transparent text-white' : 'border-line text-ink-soft hover:bg-surface')}
            style={selected ? { backgroundColor: color } : undefined}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        );
      })}
    </div>
  );
}
