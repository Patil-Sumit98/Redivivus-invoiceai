
// Styled Badge without shadcn dependency.
// All color variants in this app are applied via className, so base just
// provides shape + font. The specific color classes come from StatusBadge.

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

export const Badge = ({ className = '', ...props }: BadgeProps) => (
  <span
    className={[
      'inline-flex items-center rounded-md border px-2.5 py-0.5',
      'text-xs font-semibold',
      'transition-colors',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  />
);
