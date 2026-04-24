

interface ConfidenceBarProps {
  score: number | null | undefined;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ score }) => {
  if (score === null || score === undefined) {
    return <span className="text-gray-400 text-xs">-</span>;
  }

  // BUG-28: Use integer display — Math.round already discarded decimals,
  // so .toFixed(1) was showing misleading "85.0%"
  const scorePct = Math.round(score * 100);
  
  let colorClass = 'bg-red-500';
  if (score >= 0.90) {
    colorClass = 'bg-green-500';
  } else if (score >= 0.60) {
    colorClass = 'bg-yellow-500';
  }

  return (
    <div className="w-full flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all duration-700 ease-out`} 
          style={{ width: `${scorePct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 min-w-[36px] text-right">
        {scorePct}%
      </span>
    </div>
  );
};