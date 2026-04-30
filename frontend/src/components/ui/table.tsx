
export const Table = ({ className = '', ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <table className={`w-full caption-bottom text-sm ${className}`} {...props} />
);

export const TableHeader = ({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={`[&_tr]:border-b ${className}`} {...props} />
);

export const TableBody = ({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
);

export const TableFooter = ({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tfoot className={`bg-gray-50 font-medium ${className}`} {...props} />
);

export const TableRow = ({ className = '', ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={`border-b border-gray-200 transition-colors hover:bg-gray-50/50 ${className}`}
    {...props}
  />
);

export const TableHead = ({ className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={`h-10 px-4 text-left align-middle text-xs font-semibold text-gray-500 uppercase tracking-wider ${className}`}
    {...props}
  />
);

export const TableCell = ({ className = '', ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={`px-4 py-3 align-middle ${className}`} {...props} />
);
