import { CheckCircle2, XCircle, MinusCircle, AlertTriangle } from 'lucide-react';

interface GSTRulesPanelProps {
  gstData: any;
}

const ruleDisplay = [
  { key: 'format',          label: 'GSTIN Format Integrity', errorKey: 'error' },
  { key: 'checksum',        label: 'GSTIN Cryptographic Checksum',   errorKey: 'error' },
  { key: 'tax_math',        label: 'Statutory Tax Math Validation',         errorKey: 'error' },
  { key: 'line_items_math', label: 'Granular Line Item Math Validation',   errorKey: 'errors' },
  { key: 'date',            label: 'Chronological Date Validity',    errorKey: 'error' },
  { key: 'place_of_supply', label: 'Inter/Intra-State Supply Match',      errorKey: 'suggestion' },
];

export const GSTRulesPanel = ({ gstData }: GSTRulesPanelProps) => {
  if (!gstData || (!gstData.rules && !gstData.flags)) {
    return <div className="p-12 text-center text-ink-400 font-medium">No GST validation signatures available.</div>;
  }

  const rules = gstData.rules || {};
  const flags: string[] = gstData.flags || [];
  const passed: boolean = gstData.passed ?? false;

  return (
    <div className="space-y-6">
      {/* Flags Summary / Alert if fails */}
      {flags.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
          <h4 className="text-xs font-bold uppercase text-red-800 tracking-wider mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Exception Flags Triggered
          </h4>
          <ul className="text-xs text-red-700 list-disc pl-4 space-y-1 font-medium">
            {flags.map((fl: string, i: number) => (
              <li key={i}>{fl}</li>
            ))}
          </ul>
        </div>
      )}
      
      {passed && flags.length === 0 && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider">All constraints passed mathematically</span>
        </div>
      )}

      {/* Individual Rules List */}
      <div className="space-y-3">
        {ruleDisplay.map((item) => {
          const rule = rules[item.key];

          let Icon = MinusCircle;
          let color = 'text-ink-400';
          let badgeClass = 'bg-ink-100 text-ink-600 border border-ink-200';
          let statusText = 'N/A';
          let errorMsg: string | null = null;

          if (rule !== undefined) {
            if (rule.valid === true) {
              Icon = CheckCircle2;
              color = 'text-green-500';
              badgeClass = 'bg-green-50 text-green-700 border border-green-200';
              statusText = 'PASS';
            } else if (rule.valid === false) {
              Icon = XCircle;
              color = 'text-red-500';
              badgeClass = 'bg-red-50 text-red-700 border border-red-200';
              statusText = 'FAIL';

              // Extract error message
              if (item.errorKey === 'errors' && Array.isArray(rule.errors)) {
                errorMsg = rule.errors.join('; ');
              } else {
                errorMsg = rule[item.errorKey] || null;
              }
            }
          }

          return (
            <div key={item.key} className="flex items-start p-4 rounded-xl border border-ink-200 bg-white shadow-sm hover:shadow-md transition-all gap-4">
              <div className="pt-0.5 shrink-0">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-900 text-sm tracking-tight">{item.label}</p>
                {errorMsg && (
                  <p className="text-xs font-medium text-red-600 mt-1">{errorMsg}</p>
                )}
              </div>
              
              <div className="shrink-0">
                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${badgeClass}`}>
                  {statusText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};