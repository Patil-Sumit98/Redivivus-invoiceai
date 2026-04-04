import { CheckCircle2, XCircle, MinusCircle, AlertTriangle } from 'lucide-react';

interface GSTRulesPanelProps {
  gstData: any;
}

const ruleDisplay = [
  { key: 'format',          label: 'GSTIN Format',     errorKey: 'error' },
  { key: 'checksum',        label: 'GSTIN Checksum',   errorKey: 'error' },
  { key: 'tax_math',        label: 'Tax Math',         errorKey: 'error' },
  { key: 'line_items_math', label: 'Line Item Math',   errorKey: 'errors' },
  { key: 'date',            label: 'Date Validity',    errorKey: 'error' },
  { key: 'place_of_supply', label: 'State Match',      errorKey: 'suggestion' },
];

export const GSTRulesPanel = ({ gstData }: GSTRulesPanelProps) => {
  if (!gstData || (!gstData.rules && !gstData.flags)) {
    return <div className="p-4 text-center text-gray-500">No GST validation data available.</div>;
  }

  const rules = gstData.rules || {};
  const flags: string[] = gstData.flags || [];
  const passed: boolean = gstData.passed ?? false;

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
        {passed ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
        ) : (
          <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
        )}
        <div>
          <p className={`font-bold text-sm ${passed ? 'text-emerald-800' : 'text-red-800'}`}>
            {passed ? 'All GST rules passed' : 'GST validation failed'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {flags.length === 0 ? 'No compliance flags raised.' : `${flags.length} flag(s) raised.`}
          </p>
        </div>
      </div>

      {/* Individual Rules */}
      <div className="space-y-3">
        {ruleDisplay.map((item) => {
          const rule = rules[item.key];

          let Icon = MinusCircle;
          let color = 'text-gray-400';
          let bg = 'bg-gray-50';
          let statusText = 'N/A';
          let errorMsg: string | null = null;

          if (rule !== undefined) {
            if (rule.valid === true) {
              Icon = CheckCircle2;
              color = 'text-emerald-600';
              bg = 'bg-emerald-50';
              statusText = 'Passed';
            } else if (rule.valid === false) {
              Icon = XCircle;
              color = 'text-red-600';
              bg = 'bg-red-50';
              statusText = 'Failed';

              // Extract error message based on the rule's error key
              if (item.errorKey === 'errors' && Array.isArray(rule.errors)) {
                errorMsg = rule.errors.join('; ');
              } else {
                errorMsg = rule[item.errorKey] || null;
              }
            }
          }

          return (
            <div key={item.key} className="flex flex-col p-3 rounded-lg border border-gray-100 shadow-sm hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700 text-sm">{item.label}</span>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${bg} ${color}`}>
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">{statusText}</span>
                </div>
              </div>
              {errorMsg && (
                <p className="text-xs text-red-600 mt-2 pl-1">{errorMsg}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Flags Summary */}
      {flags.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h4 className="text-xs font-bold uppercase text-amber-800 tracking-wider mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Compliance Flags
          </h4>
          <ul className="text-xs text-amber-700 list-disc pl-4 space-y-1 font-medium">
            {flags.map((fl: string, i: number) => (
              <li key={i}>{fl}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};