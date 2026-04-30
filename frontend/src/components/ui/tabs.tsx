import React, { createContext, useContext, useState } from 'react';

// NOTE: InvoiceDetailPage uses its own native <button> tab implementation
// and does NOT use these Tabs components. These are provided for completeness
// in case other parts of the app use them in future.

const TabsContext = createContext<{
  value: string;
  onValueChange: (v: string) => void;
}>({ value: '', onValueChange: () => {} });

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs = ({ defaultValue = '', value, onValueChange, children, className = '', ...props }: TabsProps) => {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const change  = onValueChange ?? setInternal;

  return (
    <TabsContext.Provider value={{ value: current, onValueChange: change }}>
      <div className={className} {...props}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 ${className}`}
    role="tablist"
    {...props}
  />
);

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = ({ value, className = '', children, ...props }: TabsTriggerProps) => {
  const { value: current, onValueChange } = useContext(TabsContext);
  const isActive = current === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => onValueChange(value)}
      className={[
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5',
        'text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        isActive
          ? 'bg-white text-blue-700 shadow-sm'
          : 'text-gray-600 hover:text-gray-900',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
};

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = ({ value, className = '', ...props }: TabsContentProps) => {
  const { value: current } = useContext(TabsContext);
  if (current !== value) return null;

  return (
    <div
      role="tabpanel"
      className={`mt-2 focus-visible:outline-none ${className}`}
      {...props}
    />
  );
};
