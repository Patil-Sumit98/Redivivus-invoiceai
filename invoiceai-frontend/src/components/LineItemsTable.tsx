import { formatCurrency } from '../utils/formatters';
import type { LineItem } from '../types';

export const LineItemsTable = ({ items }: { items: LineItem[] | undefined | null }) => {
  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        No line items extracted from this invoice.
      </div>
    );
  }

  // Line items from backend are flat: {description, quantity, rate, amount, hsn_code}
  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">HSN</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Qty</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Rate (₹)</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Amount (₹)</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item, idx) => (
            <tr key={idx} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate" title={String(item.description || '-')}>
                {String(item.description || '-')}
              </td>
              <td className="px-4 py-3 text-gray-500">{item.hsn_code || '-'}</td>
              <td className="px-4 py-3 text-right text-gray-700">{item.quantity ?? '-'}</td>
              <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(Number(item.rate))}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(Number(item.amount))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td colSpan={5} className="px-4 py-3 text-right font-bold text-gray-900">Total</td>
            <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};