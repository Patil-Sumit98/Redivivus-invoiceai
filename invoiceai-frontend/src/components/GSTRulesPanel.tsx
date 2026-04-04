import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

export const GSTRulesPanel = ({ rules }: { rules: any }) => {
  if (!rules || Object.keys(rules).length === 0) {
    return <div className="p-4 text-center text-gray-500">No GST validation rules executed.</div>;
  }

  const ruleDisplay = [
    { key: 'gstin_format_valid', label: 'GSTIN Format' },
    { key: 'gstin_checksum_valid', label: 'GSTIN Checksum' },
    { key: 'tax_amount_math_valid', label: 'Tax Math' },
    { key: 'line_items_math_valid', label: 'Line Item Math' },
    { key: 'dates_valid', label: 'Date Validity' },
    { key: 'state_code_match', label: 'State Match' },
  ];

  return (
    <div className="space-y-4">
      {ruleDisplay.map((item) => {
        const val = rules[item.key];
        
        let Icon = MinusCircle;
        let color = 'text-gray-400';
        let bg = 'bg-gray-50';
        let statusText = 'N/A';

        if (val === true) {
          Icon = CheckCircle2;
          color = 'text-green-600';
          bg = 'bg-green-50';
          statusText = 'Passed';
        } else if (val === false) {
          Icon = XCircle;
          color = 'text-red-600';
          bg = 'bg-red-50';
          statusText = 'Failed';
        }

        return (
          <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 shadow-sm transition-colors hover:bg-slate-50">
            <span className="font-medium text-gray-700 text-sm">{item.label}</span>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${bg} ${color}`}>
              <Icon className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">{statusText}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};