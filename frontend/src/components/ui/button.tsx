import React from 'react';

// Minimal Button without shadcn/class-variance-authority dependency.
// Supports the variant and size props used throughout the app.

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
type ButtonSize   = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:     'bg-blue-600 text-white hover:bg-blue-700 border border-transparent',
  outline:     'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50',
  ghost:       'bg-transparent text-gray-700 border border-transparent hover:bg-gray-100',
  destructive: 'bg-red-600 text-white hover:bg-red-700 border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2 text-sm',
  sm:      'h-8  px-3    text-xs',
  lg:      'h-12 px-6 py-3 text-base',
  icon:    'h-9  w-9  p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size    = 'default',
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const base = [
      'inline-flex items-center justify-center',
      'rounded-md font-medium',
      'transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      variantClasses[variant],
      sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} className={base} disabled={disabled} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
