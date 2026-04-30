
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0–100
}

export const Progress = ({ value = 0, className = '', ...props }: ProgressProps) => (
  <div
    className={`relative h-2 w-full overflow-hidden rounded-full bg-gray-200 ${className}`}
    {...props}
  >
    <div
      className="h-full bg-blue-600 transition-all duration-500"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);
