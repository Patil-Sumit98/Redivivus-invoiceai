// skeleton.tsx
export const Skeleton = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`animate-pulse rounded-md bg-gray-200 ${className}`}
    {...props}
  />
);
