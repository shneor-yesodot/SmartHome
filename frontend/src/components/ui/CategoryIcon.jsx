import { getIcon } from '../../constants/icons';

/** Round tinted tile with the category's icon. */
export default function CategoryIcon({ icon, color = '#12A05C', size = 36 }) {
  const Icon = getIcon(icon);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: `${color}1A`, color }}
      aria-hidden="true"
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
