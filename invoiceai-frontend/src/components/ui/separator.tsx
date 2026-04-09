
interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const Separator = ({ orientation = 'horizontal', className = '', ...props }: SeparatorProps) => (
  <hr
    className={[
      orientation === 'horizontal' ? 'w-full border-t border-gray-200' : 'h-full border-l border-gray-200',
      className,
    ].join(' ')}
    {...props}
  />
);
