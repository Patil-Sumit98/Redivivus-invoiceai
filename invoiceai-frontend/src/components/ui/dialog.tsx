import React, { useEffect } from 'react';

// Minimal Dialog without Radix UI.
// ReviewModal does NOT use Dialog (it renders its own overlay),
// so this is only needed for future AlertDialog-style usage.

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange?.(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => onOpenChange?.(false)}
    >
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
};

export const DialogContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`relative bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const DialogHeader  = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`mb-4 ${className}`} {...props} />
);
export const DialogTitle   = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`text-lg font-semibold text-gray-900 ${className}`} {...props} />
);
export const DialogDescription = ({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-gray-500 mt-1 ${className}`} {...props} />
);
export const DialogFooter  = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`mt-6 flex justify-end gap-3 ${className}`} {...props} />
);
