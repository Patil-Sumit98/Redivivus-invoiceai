import React from 'react';

// Styled Input without shadcn dependency.
// Handles the `as` prop that some pages pass (ignored safely — always renders <input>).

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  as?: string; // accepted but ignored — always renders <input>
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', as: _as, ...props }, ref) => (
    <input
      ref={ref}
      className={[
        'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2',
        'text-sm text-gray-900 placeholder:text-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors duration-150',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
);
Input.displayName = 'Input';
