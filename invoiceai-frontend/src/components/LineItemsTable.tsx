import { formatCurrency } from '../utils/formatters';
import type { LineItem } from '../types';

export const LineItemsTable = ({ items }: { items: LineItem[] | undefined | null }) => {
  if (!items || items.length === 0) {
    return (
      <div className="p-12 text-center text-ink-400 border border-dashed border-ink-300 rounded-xl bg-ink-50 font-medium">
        No tabular line items extracted from this source.
      </div>
    );
  }

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-ink-50 border-b border-ink-200">
          <tr>
            <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider w-12">#</th>
            <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider w-24">HSN</th>
            <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider">Description</th>
            <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider text-right w-24">Qty</th>
            <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider text-right w-32">Rate</th>
            <th className="px-5 py-3 text-[11px] font-bold text-ink-500 uppercase tracking-wider text-right w-32">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 bg-white">
          {items.map((item, idx) => (
            <tr key={idx} className="hover:bg-ink-50/50 transition-colors">
              <td className="px-5 py-3.5 text-ink-400 font-medium">{idx + 1}</td>
              <td className="px-5 py-3.5 text-ink-600 font-medium">{item.hsn_code || '—'}</td>
              <td className="px-5 py-3.5 font-semibold text-ink-900 max-w-[300px] truncate" title={String(item.description || '-')}>
                {String(item.description || '-')}
              </td>
              <td className="px-5 py-3.5 text-right font-mono text-ink-700">{item.quantity ?? '—'}</td>
              <td className="px-5 py-3.5 text-right font-mono text-ink-700">{formatCurrency(Number(item.rate))}</td>
              <td className="px-5 py-3.5 text-right font-mono font-bold text-ink-900">{formatCurrency(Number(item.amount))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-ink-50 border-t border-ink-200">
          <tr>
            <td colSpan={5} className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Computed Total
            </td>
            <td className="px-5 py-4 text-right font-mono font-bold text-ink-900 text-base">
              {formatCurrency(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};