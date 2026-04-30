
// Styled Card components without shadcn dependency.

interface DivProps extends React.HTMLAttributes<HTMLDivElement> {}
interface PProps    extends React.HTMLAttributes<HTMLParagraphElement> {}

export const Card = ({ className = '', ...props }: DivProps) => (
  <div
    className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
    {...props}
  />
);

export const CardHeader = ({ className = '', ...props }: DivProps) => (
  <div
    className={`flex flex-col space-y-1.5 p-6 ${className}`}
    {...props}
  />
);

export const CardTitle = ({ className = '', ...props }: DivProps) => (
  <div
    className={`text-lg font-semibold leading-none tracking-tight text-gray-900 ${className}`}
    {...props}
  />
);

export const CardDescription = ({ className = '', ...props }: PProps) => (
  <p
    className={`text-sm text-gray-500 ${className}`}
    {...props}
  />
);

export const CardContent = ({ className = '', ...props }: DivProps) => (
  <div
    className={`p-6 pt-0 ${className}`}
    {...props}
  />
);

export const CardFooter = ({ className = '', ...props }: DivProps) => (
  <div
    className={`flex items-center p-6 pt-0 ${className}`}
    {...props}
  />
);
