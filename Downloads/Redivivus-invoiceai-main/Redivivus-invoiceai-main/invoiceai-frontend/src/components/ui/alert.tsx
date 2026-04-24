
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
}

export const Alert = ({ variant = 'default', className = '', ...props }: AlertProps) => (
  <div
    role="alert"
    className={[
      'relative w-full rounded-lg border p-4 text-sm',
      variant === 'destructive'
        ? 'border-red-300 bg-red-50 text-red-800'
        : 'border-gray-200 bg-white text-gray-800',
      className,
    ].join(' ')}
    {...props}
  />
);

export const AlertTitle = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`mb-1 font-semibold leading-none tracking-tight ${className}`} {...props} />
);

export const AlertDescription = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`text-sm opacity-90 ${className}`} {...props} />
);
